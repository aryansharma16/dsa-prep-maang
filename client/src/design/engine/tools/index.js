import { createConnectorTool } from './connector.js';
import { createShapeTool } from './create.js';
import { createDrawTool } from './draw.js';
import { createEraserTool } from './eraser.js';
import { createSelectTool } from './select.js';

/** Every tool the canvas has, keyed by the name `ui.tool` holds. */
export function createTools(editor) {
  return {
    select: createSelectTool(editor),
    // Panning itself lives in the editor, so Space and the middle button work under every tool.
    hand: { id: 'hand', cursor: 'grab' },
    frame: createShapeTool(editor, 'frame'),
    rect: createShapeTool(editor, 'rect'),
    ellipse: createShapeTool(editor, 'ellipse'),
    diamond: createShapeTool(editor, 'diamond'),
    cylinder: createShapeTool(editor, 'cylinder'),
    text: createShapeTool(editor, 'text'),
    paragraph: createShapeTool(editor, 'paragraph'),
    sticky: createShapeTool(editor, 'sticky'),
    connector: createConnectorTool(editor),
    pen: createDrawTool(editor, 'pen'),
    highlighter: createDrawTool(editor, 'highlighter'),
    eraser: createEraserTool(editor),
  };
}
