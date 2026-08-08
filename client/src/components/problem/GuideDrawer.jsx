import { useGuide } from '../../hooks/useGuide.js';
import { Drawer } from '../ui/Drawer.jsx';
import { GuideBlocks } from './GuideBlocks.jsx';

/**
 * The pattern reference, opened from the ⓘ on a section heading.
 *
 * `pattern` is what the roadmap already knows about the pattern, so the drawer
 * can title itself and show the blurb on the first frame instead of waiting on
 * the request.
 */
export function GuideDrawer({ pattern, onClose }) {
  const { data, loading, error } = useGuide(pattern.slug);
  const guide = data?.guide;

  return (
    <Drawer
      title={guide?.title || pattern.name}
      subtitle={guide?.summary || pattern.blurb}
      onClose={onClose}
    >
      {loading && (
        <div className="guide-loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      )}

      {!loading && error && <div className="alert">{error}</div>}

      {!loading && !error && !guide && (
        <p className="hint">
          No guide written for this pattern yet. The techniques below are what it comes down
          to:
          {pattern.keyTechniques?.length ? ` ${pattern.keyTechniques.join(', ')}.` : ''}
        </p>
      )}

      {!loading && !error && guide && <GuideBlocks blocks={guide.blocks} />}
    </Drawer>
  );
}
