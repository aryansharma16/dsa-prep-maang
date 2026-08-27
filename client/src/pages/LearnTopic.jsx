import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AskAi } from '../components/learn/AskAi.jsx';
import { LearnToc } from '../components/learn/LearnToc.jsx';
import { GuideBlocks, guideHeadings } from '../components/problem/GuideBlocks.jsx';
import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconRotate,
} from '../components/ui/Icons.jsx';
import { isAnyModalOpen } from '../components/ui/Modal.jsx';
import { useLearnDoc } from '../hooks/useLearnDoc.js';
import { scrollProgress, useScrollContainer } from '../hooks/useScrollContainer.js';
import { topicKey, useReadTopics, useTopicRevision } from '../learn/progress.js';
import { findTrack, flatTopics } from '../learn/tracks.js';

/**
 * One topic, read.
 *
 * Two imports deep: the track index gives the title, the summary and the
 * neighbours for prev/next, and the topic's own module gives the blocks. Both go
 * through the same cache, so arriving from the track page costs only the second
 * one — and the topic card has usually already fetched that on hover.
 *
 * The body is `GuideBlocks`, unchanged and unwrapped. That is the point of
 * authoring Learn content in the guide block shapes: code tabs, copy buttons,
 * callouts, tables and the syntax colours all came for free, and a fix to any of
 * them lands in both places at once.
 */
export function LearnTopic() {
  const { track: trackSlug, topic: topicSlug } = useParams();
  const track = findTrack(trackSlug);
  const navigate = useNavigate();

  const [pageRef, container] = useScrollContainer();

  const { data: index, loading: indexLoading } = useLearnDoc(
    track?.status === 'live' ? trackSlug : null,
    track?.load,
  );

  const topics = useMemo(() => flatTopics(index?.sections), [index]);
  const position = topics.findIndex((entry) => entry.slug === topicSlug);
  const topic = position === -1 ? null : topics[position];

  const { data: doc, loading, error } = useLearnDoc(
    topic ? `${trackSlug}/${topicSlug}` : null,
    topic?.load,
  );

  const previous = position > 0 ? topics[position - 1] : null;
  const next = position < topics.length - 1 ? topics[position + 1] : null;

  const { read, mark } = useReadTopics();
  const revision = useTopicRevision(trackSlug, topicSlug);
  /* Defaults to 3 like every other confidence in the app. The number is what
     stretches or shrinks the gap before this comes back. */
  const [confidence, setConfidence] = useState(3);
  const key = topicKey(trackSlug, topicSlug);
  const isRead = Boolean(read[key]);

  const [progress, setProgress] = useState(0);
  const blocks = doc?.doc?.blocks;
  const headings = useMemo(() => guideHeadings(blocks), [blocks]);

  /*
    A topic is a document, and arriving at one halfway down is disorienting.
    Keyed on the slug rather than on `doc` so the jump happens as the route
    changes, not a frame later when the chunk resolves — except when the URL
    carries an anchor, which is someone arriving at a specific section and must
    not be yanked to the top.
  */
  useEffect(() => {
    if (!container) return;
    if (!window.location.hash) container.scrollTo({ top: 0 });
  }, [container, topicSlug]);

  /*
    Deep links. The anchor cannot be resolved until the topic's chunk has landed
    and its headings are in the DOM, so this waits for the blocks rather than
    running on mount.
  */
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash || !blocks) return;
    document.getElementById(hash)?.scrollIntoView({ block: 'start' });
  }, [blocks]);

  /*
    The progress rule, and the read mark that rides on it. One rAF-throttled
    listener for both: reading to the end is what "read" means here, and asking
    the reader to also press a button to say so is a second job for the same
    fact. The button below stays, for marking something read you skimmed — and
    for taking it back.

    90% rather than 100% because the pager, the ask-AI block and the footer
    links are all below the last paragraph. You have finished the words well
    before you have finished the page.
  */
  useEffect(() => {
    if (!container || !blocks) return undefined;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const value = scrollProgress(container);
      setProgress(value);
      if (value >= 0.9) mark(key, true);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [container, blocks, key, mark]);

  /*
    Left and right walk the track, the way they turn pages everywhere else.
    Guarded against firing while someone is typing — the filter box on the track
    page, the chat composer in the dock — and while a modal is open, which is the
    same check the rest of the shell's shortcuts make.
  */
  const go = useCallback(
    (entry) => entry && navigate(`/learn/${trackSlug}/${entry.slug}`),
    [navigate, trackSlug],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isAnyModalOpen()) return;
      const el = e.target;
      if (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === 'ArrowLeft') go(previous);
      else if (e.key === 'ArrowRight') go(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, previous, next]);

  if (!track || track.status !== 'live') {
    return (
      <div className="empty">
        <h3>No such track</h3>
        <p>
          <Link to="/learn">Back to Learn</Link>
        </p>
      </div>
    );
  }

  if (indexLoading) return <div className="loading">Loading...</div>;

  if (!topic) {
    return (
      <div className="empty">
        <h3>No such topic</h3>
        <p>
          It may have been renamed. <Link to={`/learn/${trackSlug}`}>See every {track.name} topic</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Outside .learn-page, which is a flex row — see the CSS. Transform-only,
          so scrolling never lays anything out. */}
      <div className="learn-rule" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div className="learn-page" ref={pageRef}>
        <article className="learn-col">
          <div className="learn-crumb">
            <Link to={`/learn/${trackSlug}`}>
              <IconArrowLeft size={13} />
              {track.name}
            </Link>
            <span className="learn-crumb-pos mono">
              {String(position + 1).padStart(2, '0')} / {topics.length}
            </span>
          </div>

          <div className="page-head">
            <h1>{topic.title}</h1>
            <p>{topic.summary}</p>
          </div>

          <AskAi questions={topic.ask} compact />

          {loading && (
            <div className="guide-loading">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          )}

          {!loading && error && <div className="alert">{error}</div>}

          {!loading && !error && blocks && <GuideBlocks blocks={blocks} />}

          {!loading && !error && (
            <>
              <AskAi questions={topic.ask} />

              <div className="learn-done">
                <button
                  type="button"
                  className={`learn-done-btn ${isRead ? 'on' : ''}`}
                  onClick={() => mark(key, !isRead)}
                  aria-pressed={isRead}
                >
                  <IconCheck size={12} />
                  {isRead ? 'Read' : 'Mark as read'}
                </button>
                {next && (
                  <span className="learn-done-hint">
                    Use <kbd className="mono">&larr;</kbd> and <kbd className="mono">&rarr;</kbd> to
                    move between topics
                  </span>
                )}
              </div>

              {/*
                Putting a topic on the revision ladder.

                Separate from "Mark as read" above, and deliberately so: read is
                set by scrolling to the bottom as well as by that button, so it
                means "my eyes have been over this". This is the deliberate act —
                it schedules the topic to come back on the same 3/7/21/60 ladder a
                problem goes on, and a page you skimmed on the train has no
                business turning up in Tuesday's queue.

                `scheduled === null` is "still loading", which draws nothing
                rather than flashing the wrong state and correcting itself.
              */}
              {revision.scheduled !== null && (
                <div className="learn-revise">
                  {revision.scheduled ? (
                    <>
                      <span className="learn-revise-on">
                        <IconRotate size={12} />
                        In your revision queue
                        {revision.scheduled.nextReviewAt && (
                          <b>
                            {' '}
                            · back on{' '}
                            {new Date(revision.scheduled.nextReviewAt).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </b>
                        )}
                      </span>
                      <button
                        type="button"
                        className="link-btn"
                        disabled={revision.busy}
                        onClick={revision.unschedule}
                      >
                        Take it off
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="learn-revise-label">How solid does this feel?</span>
                      <span className="confidence">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`dot ${n <= confidence ? 'on' : ''}`}
                            aria-label={`${n} of 5`}
                            aria-pressed={n === confidence}
                            onClick={() => setConfidence(n)}
                          />
                        ))}
                      </span>
                      <button
                        type="button"
                        className="btn sm"
                        disabled={revision.busy}
                        onClick={() => revision.schedule(confidence, topic.title)}
                      >
                        <IconRotate size={12} />
                        {revision.busy ? 'Saving…' : 'Revise this'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <nav className="learn-nav" aria-label="Nearby topics">
            {previous ? (
              <Link className="learn-nav-link prev" to={`/learn/${trackSlug}/${previous.slug}`}>
                <span className="learn-nav-dir">
                  <IconArrowLeft size={12} />
                  Previous
                </span>
                <span className="learn-nav-title">{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link className="learn-nav-link next" to={`/learn/${trackSlug}/${next.slug}`}>
                <span className="learn-nav-dir">
                  Next
                  <IconChevronRight size={12} />
                </span>
                <span className="learn-nav-title">{next.title}</span>
              </Link>
            )}
          </nav>
        </article>

        <LearnToc headings={headings} />
      </div>
    </>
  );
}
