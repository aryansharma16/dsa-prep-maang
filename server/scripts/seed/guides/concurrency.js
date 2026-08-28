import { code, cpp, h, java, link, links, p, table, tip, ul, warn } from './blocks.js';

export default {
  patternSlug: 'concurrency',
  title: 'Concurrency',
  summary: 'Order operations across threads with the smallest possible amount of shared state.',
  blocks: [
    p(
      'These are the odd ones out. Every other pattern here asks you to find an algorithm; this one hands you a trivial algorithm — print three lines in order, print numbers alternately — and asks whether you can make several threads agree on when each is allowed to run. The work is not in what to compute. It is in what to wait for.',
    ),
    p(
      'There are only six of these on LeetCode without a subscription, and that is the whole pattern. They exist here because a real round asks them: Databricks runs a dedicated concurrency interview, and Netflix and Palantir put threading questions in the middle of an otherwise ordinary algorithm loop. Six problems is an evening, and an evening is enough to stop being surprised by the question.',
    ),
    p(
      'The mental model that makes all six easy: a thread that cannot proceed must *block*, not spin, and the thing it blocks on must be released by whichever thread makes the condition true. Every wrong answer in this pattern is a variation on one of two failures — the waiter never gets woken, or two threads both believed they were allowed to go.',
    ),

    h('When to reach for it'),
    ul(
      'The signature takes callbacks or Runnables and the class is constructed once and called from several threads.',
      'The statement says "the threads may be called in any order" and then fixes the required output order.',
      'You are asked to implement a bounded buffer, a barrier, a semaphore or a lock from cheaper primitives.',
      'The interviewer follows an ordinary problem with "now make it thread-safe" — the same reasoning applies.',
      'Anything with the words deadlock, starvation or race condition in it.',
    ),

    h('The core idea'),
    p(
      'A permit you cannot take until somebody gives it to you. That is a semaphore, and it solves four of the six problems directly. Start each gate at zero permits except the one that is allowed to run first; every thread acquires its own gate, does its work, then releases the gate of whoever comes next. The ordering is not enforced by cleverness — it is enforced by the fact that a thread asking for a permit that does not exist goes to sleep.',
    ),
    code(
      java(`
// Print in Order — first() then second() then third(), any call order.
class Foo {
    private final Semaphore runSecond = new Semaphore(0);   // no permit yet
    private final Semaphore runThird  = new Semaphore(0);   // no permit yet

    public void first(Runnable printFirst) throws InterruptedException {
        printFirst.run();
        runSecond.release();          // hand the permit to second()
    }

    public void second(Runnable printSecond) throws InterruptedException {
        runSecond.acquire();          // blocks until first() released it
        printSecond.run();
        runThird.release();
    }

    public void third(Runnable printThird) throws InterruptedException {
        runThird.acquire();
        printThird.run();
    }
}
`),
      cpp(`
// Same shape in C++20. counting_semaphore is the direct equivalent;
// before C++20 you would write this with a mutex and a condition_variable.
class Foo {
    std::counting_semaphore<1> runSecond{0};
    std::counting_semaphore<1> runThird{0};

public:
    void first(std::function<void()> printFirst) {
        printFirst();
        runSecond.release();
    }

    void second(std::function<void()> printSecond) {
        runSecond.acquire();
        printSecond();
        runThird.release();
    }

    void third(std::function<void()> printThird) {
        runThird.acquire();
        printThird();
    }
};
`),
    ),
    p(
      'Notice what is *not* there: no shared counter, no flag, no sleep, no loop that checks whether it is its turn yet. The permits are the entire state. When you can express the ordering as "who releases whom", the code has no race to reason about, because at every moment exactly one thread holds a permit it can act on.',
    ),

    h('Variations'),
    p(
      'Alternating between two threads, n times — Print FooBar. The same two-semaphore idea, in a loop. The only new thing is that the last release of each iteration re-arms the other side, so the pair ping-pongs rather than running once.',
    ),
    code(
      java(`
class FooBar {
    private final Semaphore fooTurn = new Semaphore(1);   // foo goes first
    private final Semaphore barTurn = new Semaphore(0);
    private final int n;

    FooBar(int n) { this.n = n; }

    public void foo(Runnable printFoo) throws InterruptedException {
        for (int i = 0; i < n; i++) {
            fooTurn.acquire();
            printFoo.run();
            barTurn.release();
        }
    }

    public void bar(Runnable printBar) throws InterruptedException {
        for (int i = 0; i < n; i++) {
            barTurn.acquire();
            printBar.run();
            fooTurn.release();
        }
    }
}
`),
    ),
    p(
      'A condition that is not simply "your turn" — Building H2O, where two hydrogen and one oxygen must group before any of them proceeds. Permits still work (two on hydrogen, one on oxygen) but you also need a barrier so a molecule is released together rather than as three independent arrivals. Java\'s CyclicBarrier is exactly this, and reaching for it instead of hand-rolling a counter is the right answer in an interview.',
    ),
    code(
      java(`
class H2O {
    private final Semaphore hydrogen = new Semaphore(2);
    private final Semaphore oxygen   = new Semaphore(1);
    // Releases all three only once all three have arrived.
    private final CyclicBarrier barrier = new CyclicBarrier(3);

    public void hydrogen(Runnable releaseHydrogen) throws InterruptedException {
        hydrogen.acquire();
        try { barrier.await(); } catch (BrokenBarrierException e) { /* ignore */ }
        releaseHydrogen.run();
        hydrogen.release();
    }

    public void oxygen(Runnable releaseOxygen) throws InterruptedException {
        oxygen.acquire();
        try { barrier.await(); } catch (BrokenBarrierException e) { /* ignore */ }
        releaseOxygen.run();
        oxygen.release();
    }
}
`),
    ),
    p(
      'Waiting on a predicate rather than a permit — the condition-variable form. Use it when "may I go?" is a question about shared state, not about a handoff. The rule that makes it correct is unconditional: wait inside a while loop, never an if. A thread can wake without the condition holding, and an if means it proceeds anyway.',
    ),
    code(
      java(`
// Fizz Buzz Multithreaded — four threads, one shared counter.
class FizzBuzz {
    private final Object lock = new Object();
    private int i = 1;
    private final int n;

    FizzBuzz(int n) { this.n = n; }

    public void fizz(Runnable printFizz) throws InterruptedException {
        synchronized (lock) {
            while (i <= n) {
                if (i % 3 == 0 && i % 5 != 0) {
                    printFizz.run();
                    i++;
                    lock.notifyAll();     // never notify() — see below
                } else {
                    lock.wait();          // while, not if: spurious wakeups exist
                }
            }
        }
    }
    // buzz, fizzbuzz and number are the same shape with a different predicate.
}
`),
      cpp(`
class FizzBuzz {
    std::mutex m;
    std::condition_variable cv;
    int i = 1;
    int n;

public:
    FizzBuzz(int n) : n(n) {}

    void fizz(std::function<void()> printFizz) {
        std::unique_lock<std::mutex> lock(m);
        while (i <= n) {
            // The predicate overload of wait() is the while loop, written once.
            cv.wait(lock, [&] { return i > n || (i % 3 == 0 && i % 5 != 0); });
            if (i > n) break;
            printFizz();
            i++;
            cv.notify_all();
        }
    }
};
`),
    ),
    p(
      'Deadlock avoidance — the Dining Philosophers. Five philosophers, five forks, each needs the two beside them. The naive answer (always take the left fork first) deadlocks when all five take their left fork at once and wait forever for a right one that will never be free. The fix is to break the symmetry, and there are three standard ways: let at most four eat at a time, have odd-numbered philosophers pick up right-then-left, or take both forks under a single lock so the acquisition is atomic.',
    ),
    code(
      java(`
class DiningPhilosophers {
    private final ReentrantLock[] forks = new ReentrantLock[5];
    // At most four seated means at least one philosopher always has both forks.
    private final Semaphore seats = new Semaphore(4);

    DiningPhilosophers() {
        for (int i = 0; i < 5; i++) forks[i] = new ReentrantLock();
    }

    public void wantsToEat(int philosopher,
                           Runnable pickLeftFork, Runnable pickRightFork,
                           Runnable eat,
                           Runnable putLeftFork, Runnable putRightFork)
            throws InterruptedException {
        int left = philosopher, right = (philosopher + 1) % 5;

        seats.acquire();
        forks[left].lock();
        forks[right].lock();

        pickLeftFork.run();
        pickRightFork.run();
        eat.run();
        putLeftFork.run();
        putRightFork.run();

        forks[right].unlock();
        forks[left].unlock();
        seats.release();
    }
}
`),
    ),

    h('Language toolkit'),
    table(
      ['Need', 'Java', 'C++'],
      [
        ['Counted permit', 'Semaphore(n)', 'std::counting_semaphore<max>{n} (C++20)'],
        ['Mutual exclusion', 'synchronized / ReentrantLock', 'std::mutex + std::lock_guard'],
        ['Wait for a predicate', 'lock.wait() / notifyAll()', 'std::condition_variable::wait(lock, pred)'],
        ['All parties arrived', 'CyclicBarrier(n)', 'std::barrier<>(n) (C++20)'],
        ['One-shot latch', 'CountDownLatch(n)', 'std::latch(n) (C++20)'],
        ['Lock-free counter', 'AtomicInteger', 'std::atomic<int>'],
        ['Two locks, no deadlock', 'ReentrantLock + tryLock', 'std::lock(a, b) / std::scoped_lock'],
      ],
    ),
    tip(
      'Reach for a semaphore first. If the ordering can be written as "thread A releases the gate thread B is waiting on", you are done, and there is no shared mutable state left to get wrong. Only move to a mutex and a condition variable when the thing being waited on is a value rather than a turn.',
    ),

    h('Complexity'),
    p(
      'Big-O is the wrong axis here — every one of these problems is O(n) work in total, and the interviewer is not asking about it. What they are listening for is whether your solution blocks instead of spinning, whether it can deadlock, and whether it is fair. Say those three things out loud about your own answer before they ask.',
    ),
    table(
      ['Property', 'What it means', 'How to check yours'],
      [
        ['Blocking, not spinning', 'A waiting thread consumes no CPU', 'No while(flag){} loop with an empty body'],
        ['Deadlock-free', 'No cycle of threads each holding what another wants', 'Order every multi-lock acquisition identically'],
        ['No lost wakeup', 'A signal cannot arrive before the waiter sleeps', 'Signal while holding the same lock the waiter waits on'],
        ['Starvation-free', 'Every thread eventually proceeds', 'notifyAll rather than notify; bounded seating'],
      ],
    ),

    h('Common mistakes'),
    ul(
      'Using `if` instead of `while` around a wait. Spurious wakeups are real and permitted by both languages; an `if` lets a thread continue with the condition false.',
      'Calling notify() when several distinct predicates share one lock — it may wake a thread that cannot proceed, which then sleeps again while the one that could is never woken. notifyAll() is the safe default.',
      'Signalling without holding the lock, so the signal lands between the waiter checking its predicate and going to sleep. The wakeup is lost and the thread waits for ever.',
      'Busy-waiting on a volatile flag and calling it a solution. It is correct and it will still be marked down — it burns a core to avoid learning a primitive.',
      'Taking two locks in different orders in different methods. This is the deadlock, and it is invisible in testing until it is not.',
      'Starting a semaphore at 1 when it gates the thread that must go *second*. Every gate except the first starts at zero.',
      'Assuming the methods are called in the order they appear in the class. They are called from separate threads in an arbitrary order, which is the entire problem.',
    ),

    warn(
      'These are the only six problems here whose tests can pass on a broken solution. A race that needs a specific interleaving may not show up in fifty runs, so "it was accepted" is weaker evidence than usual. Reason about the invariant instead: at every point, which thread holds what, and who is able to wake it.',
    ),

    links(
      link('Java Semaphore — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/Semaphore.html'),
      link('Java CyclicBarrier — API reference', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CyclicBarrier.html'),
      link('Java Object.wait — the spurious-wakeup contract', 'https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html'),
      link('cppreference — std::condition_variable', 'https://en.cppreference.com/w/cpp/thread/condition_variable'),
      link('cppreference — std::counting_semaphore', 'https://en.cppreference.com/w/cpp/thread/counting_semaphore'),
    ),
  ],
};
