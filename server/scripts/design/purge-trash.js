import mongoose from 'mongoose';

import { connectDb, disconnectDb } from '../../src/config/db.js';
import { DESIGN_LIMITS } from '../../src/config/design.js';
import { DesignBoard } from '../../src/models/DesignBoard.js';
import { DesignElement } from '../../src/models/DesignElement.js';
import { DesignNode } from '../../src/models/DesignNode.js';
import { DesignProject } from '../../src/models/DesignProject.js';
import { purgeNode } from '../../src/services/design/tree.service.js';
import { purgeProject } from '../../src/services/design/project.service.js';

/**
 * Empties the system design trash of anything older than the retention window,
 * and sweeps up what interrupted operations left behind.
 *
 * Nothing in the running server deletes on a timer — there is no job runner —
 * so "items in the trash are deleted after 30 days" is only true if this runs.
 * Schedule it (a daily crontab entry on the API box; see docs/aws-runbook.md).
 *
 * Three passes, each safe to repeat:
 *
 * 1. Projects trashed longer than `--days` ago, with everything in them.
 * 2. Folders and boards trashed longer ago than that, inside live projects.
 * 3. Orphans: elements whose board no longer exists (a duplicate that crashed
 *    mid-copy, or a purge interrupted between deleting the board and its
 *    elements), and boards whose node is gone.
 *
 * `--files` also runs the shared `purgeDeleted()` sweep from file.service.js,
 * which removes the bytes of every soft-deleted upload in the app, not only
 * this module's. Opt-in for that reason.
 *
 *   npm run design:purge-trash -- --days=30 --dry-run
 */

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  }),
);
const days = Number(args.days ?? DESIGN_LIMITS.trashDays);
const dryRun = Boolean(args['dry-run']);
const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function main() {
  await connectDb();
  console.log(`[design] purging trash older than ${days} days (${cutoff.toISOString()})${dryRun ? ' — dry run' : ''}`);

  // 1. Whole projects.
  const projects = await DesignProject.find({ deletedAt: { $ne: null, $lte: cutoff } }).lean();
  for (const project of projects) {
    if (dryRun) {
      console.log(`[design] would purge project ${project._id} "${project.name}"`);
      continue;
    }
    const counts = await purgeProject(project);
    console.log(`[design] purged project ${project._id}: ${counts.boards} boards, ${counts.elements} elements`);
  }

  // 2. Trashed roots inside live projects.
  const roots = await DesignNode.find({
    deletedAt: { $ne: null, $lte: cutoff },
    $expr: { $eq: ['$deletedRoot', '$_id'] },
  }).lean();
  for (const node of roots) {
    const project = await DesignProject.findOne({ _id: node.project, deletedAt: null }).lean();
    if (!project) continue;
    if (dryRun) {
      console.log(`[design] would purge ${node.kind} ${node._id} "${node.name}"`);
      continue;
    }
    const { ids, elements } = await purgeNode({ project, node });
    console.log(`[design] purged ${node.kind} ${node._id}: ${ids.length} nodes, ${elements} elements`);
  }

  // 3. Orphans.
  const boardIds = await DesignElement.distinct('board');
  const existing = new Set((await DesignBoard.find({ _id: { $in: boardIds } }).distinct('_id')).map(String));
  const orphanBoards = boardIds.filter((id) => !existing.has(String(id)));
  if (orphanBoards.length) {
    if (dryRun) console.log(`[design] would remove elements of ${orphanBoards.length} missing boards`);
    else {
      const { deletedCount } = await DesignElement.deleteMany({ board: { $in: orphanBoards } });
      console.log(`[design] removed ${deletedCount} orphaned elements`);
    }
  }

  const allBoards = await DesignBoard.find().select('_id').lean();
  const nodeIds = new Set((await DesignNode.find({ _id: { $in: allBoards.map((b) => b._id) } }).distinct('_id')).map(String));
  const boardsWithoutNodes = allBoards.filter((b) => !nodeIds.has(String(b._id))).map((b) => b._id);
  if (boardsWithoutNodes.length) {
    if (dryRun) console.log(`[design] would remove ${boardsWithoutNodes.length} boards with no node`);
    else {
      await DesignElement.deleteMany({ board: { $in: boardsWithoutNodes } });
      await DesignBoard.deleteMany({ _id: { $in: boardsWithoutNodes } });
      console.log(`[design] removed ${boardsWithoutNodes.length} boards with no node`);
    }
  }

  if (args.files && !dryRun) {
    const { purgeDeleted } = await import('../../src/services/file.service.js');
    console.log('[design] file sweep:', await purgeDeleted());
  }
}

main()
  .catch((error) => {
    console.error('[design] purge failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
    // Mongoose keeps a timer alive for a few seconds after disconnect on some drivers.
    if (mongoose.connection.readyState !== 0) process.exit();
  });
