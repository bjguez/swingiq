import { useEffect } from "react";

interface PageMeta {
  title: string;
  description: string;
  path?: string;
}

const BASE_URL = "https://swingstudio.ai";
const OG_IMAGE = `${BASE_URL}/opengraph.png`;

function setMeta(property: string, content: string, attr: "property" | "name" = "property") {
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function usePageMeta({ title, description, path = "" }: PageMeta) {
  useEffect(() => {
    const fullTitle = `${title} — Swing Studio`;
    const url = `${BASE_URL}${path}`;

    document.title = fullTitle;
    setMeta("description", description, "name");

    setMeta("og:title", fullTitle);
    setMeta("og:description", description);
    setMeta("og:url", url);
    setMeta("og:image", OG_IMAGE);

    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", OG_IMAGE);
  }, [title, description, path]);
}
