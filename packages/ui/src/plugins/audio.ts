import { $node, $remark, $command } from "@milkdown/kit/utils";
import directive from 'remark-directive'; // Example: using directives for !audio[src]

export const remarkAudio = $remark('remarkAudio', () => directive);

export const insertAudioCommand = $command('InsertAudio', () => (src: string = "") => {
  return (state, dispatch) => {
    const { schema } = state;
    const type = schema.nodes.audio;
    if (!type) return false;
    dispatch?.(state.tr.replaceSelectionWith(type.create({ src })));
    return true;
  };
});

export const audioNode = $node("audio", () => ({
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
        class: "audio-container my-6 p-4 bg-slate-50 rounded-2xl border border-slate-200",
        "data-src": src 
      },
      ["audio", { 
        src: src, 
        controls: "true", 
        class: "w-full",
        preload: "metadata"
      }],
    ];
  },
  // How it is parsed from HTML
  parseDOM: [
    {
      tag: "div.audio-container",
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) return false;
        return { src: dom.getAttribute("data-src") || dom.querySelector('audio')?.getAttribute('src') };
      },
    },
  ],
  // Conversion to/from Markdown
  parseMarkdown: {
    match: (node) => node.type === "leafDirective" && node.name === "audio",
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
    match: (node) => node.type.name === "audio",
    runner: (state, node) => {
      state.addNode("leafDirective", undefined, undefined, {
        name: "audio",
        attributes: { src: node.attrs.src },
      });
    },
  },
}));

export const audioPlugin = [remarkAudio, audioNode, insertAudioCommand].flat();
