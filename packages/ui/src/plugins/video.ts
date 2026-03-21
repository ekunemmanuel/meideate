import { $node, $command } from "@milkdown/kit/utils";

export const insertVideoCommand = $command('InsertVideo', () => (src: string = "") => {
  return (state, dispatch) => {
    const { schema } = state;
    const type = schema.nodes.video;
    if (!type) return false;
    dispatch?.(state.tr.replaceSelectionWith(type.create({ src })));
    return true;
  };
});

export const videoNode = $node("video", () => ({
  group: "block",
  attrs: {
    src: { default: null },
  },
  // How it appears in the editor
  toDOM: (node) => {
    const src = node.attrs.src || "";
    return [
      "div",
      { 
        class: "video-container my-8 p-4 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden",
        "data-src": src 
      },
      ["video", { 
        src: src, 
        controls: "true", 
        class: "w-full aspect-video rounded-xl shadow-sm",
        preload: "metadata"
      }],
    ];
  },
  // How it is parsed from HTML
  parseDOM: [
    {
      tag: "div.video-container",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return { src: dom.getAttribute("data-src") || dom.querySelector('video')?.getAttribute('src') };
      },
    },
  ],
  // Conversion to/from Markdown
  parseMarkdown: {
    match: (node) => node.type === "leafDirective" && node.name === "video",
    runner: (state, node, type) => {
      const directive = node as any;
      const attrs = directive.attributes || {};
      const children = directive.children || [];
      
      const findValue = (nodes: any[]): string => {
        for (const n of nodes) {
          if (n.value) return n.value;
          if (n.url) return n.url;
          if (n.children) {
            const val = findValue(n.children);
            if (val) return val;
          }
        }
        return "";
      };

      const src = attrs.src || attrs.url || findValue(children);
      state.addNode(type, { src: src || "" });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "video",
    runner: (state, node) => {
      state.addNode("leafDirective", undefined, undefined, {
        name: "video",
        attributes: { src: node.attrs.src },
      });
    },
  },
}));

export const videoPlugin = [videoNode, insertVideoCommand].flat();
