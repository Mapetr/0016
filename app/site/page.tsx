"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatBytes } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 30;

// The main uploading site. On the gallery subdomain "/" resolves to the
// gallery itself, so links back home need the absolute URL.
const MAIN_SITE_URL = process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "/";

type PublicFile = {
  _id: string;
  _creationTime: number;
  url: string;
  type: string;
  size: number;
  author: string;
};

function fileName(url: string): string {
  try {
    const last = new URL(url).pathname.split("/").pop() ?? "";
    return decodeURIComponent(last) || "untitled";
  } catch {
    return "untitled";
  }
}

function postedAgo(creationTime: number): string {
  const days = Math.floor((Date.now() - creationTime) / 86_400_000);
  if (days < 1) return "today";
  return `${days}d ago`;
}

// Deterministic shuffle so "random" stays stable per visit
function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function GlyphoPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [nav, setNav] = useState<"feed" | "random">("feed");
  const [seed, setSeed] = useState(1);
  const [search, setSearch] = useState("");
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const {
    results: files,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.files.getPublicFiles,
    {},
    { initialNumItems: PAGE_SIZE },
  );

  const visible = useMemo(() => {
    let list = files as PublicFile[];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (f) =>
          fileName(f.url).toLowerCase().includes(q) ||
          f.author.toLowerCase().includes(q),
      );
    }
    return nav === "random" ? shuffle(list, seed) : list;
  }, [files, search, nav, seed]);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && status === "CanLoadMore") {
          loadMore(PAGE_SIZE);
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [status, loadMore]);

  // "/" focuses search, like the design's kbd hint
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const copyLink = async (file: PublicFile) => {
    await navigator.clipboard.writeText(file.url).catch(() => {});
    setCopiedId(file._id);
    setTimeout(() => setCopiedId(null), 1400);
  };

  const currentFile = lightboxId
    ? (files as PublicFile[]).find((f) => f._id === lightboxId)
    : null;

  const isLoading =
    status === "LoadingFirstPage" || status === "LoadingMore";
  const isEmpty = status === "Exhausted" && files.length === 0;

  return (
    <div className={`glypho-app theme-${theme}`}>
      <header className="hdr">
        <div className="hdr-left">
          <a className="logo" href="#" onClick={(e) => e.preventDefault()}>
            <div className="logo-mark">
              <div className="logo-sq" />
              <div className="logo-sq" />
              <div className="logo-sq" />
              <div className="logo-sq" />
            </div>
            <span className="logo-word">glypho</span>
            <span className="logo-tag">/gif host</span>
          </a>
          <nav className="hdr-nav">
            <button
              className={`nav-link ${nav === "feed" ? "active" : ""}`}
              onClick={() => setNav("feed")}
            >
              feed
            </button>
            <button
              className={`nav-link ${nav === "random" ? "active" : ""}`}
              onClick={() => {
                setNav("random");
                setSeed((s) => s + 1);
              }}
            >
              random
            </button>
          </nav>
        </div>
        <div className="hdr-search">
          <span className="search-prefix">$</span>
          <input
            ref={searchRef}
            placeholder="search: name, author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="search-kbd">/</span>
        </div>
        <div className="hdr-right">
          <button
            className="btn btn-ghost"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            title="toggle theme"
          >
            {theme === "light" ? "dark" : "light"}
          </button>
          <a className="btn btn-primary" href={MAIN_SITE_URL}>
            <span className="btn-icon">+</span> upload
          </a>
        </div>
      </header>

      {isEmpty ? (
        <div className="empty">
          <div className="empty-title">nothing here yet</div>
          <div className="empty-sub">
            be the first — upload an image and check “add to glypho”
          </div>
          <a className="btn btn-primary" href={MAIN_SITE_URL}>
            <span className="btn-icon">+</span> upload
          </a>
        </div>
      ) : (
        <div className="collage layout-masonry">
          {visible.map((file) => (
            <Tile
              key={file._id}
              file={file}
              copied={copiedId === file._id}
              onClick={() => setLightboxId(file._id)}
              onCopy={() => copyLink(file)}
            />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="sentinel">
        {isLoading ? (
          <Loader />
        ) : status === "Exhausted" && files.length > 0 ? (
          <div className="end-mark">— end of feed —</div>
        ) : null}
      </div>

      <Footer />

      {currentFile && (
        <Lightbox
          file={currentFile}
          copied={copiedId === currentFile._id}
          onCopy={() => copyLink(currentFile)}
          onClose={() => setLightboxId(null)}
        />
      )}
    </div>
  );
}

function Tile({
  file,
  copied,
  onClick,
  onCopy,
}: {
  file: PublicFile;
  copied: boolean;
  onClick: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="tile" onClick={onClick}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="tile-img" src={file.url} alt={fileName(file.url)} loading="lazy" />

      {file.type === "image/gif" && <div className="tile-badge">GIF</div>}

      <div className="tile-overlay">
        <div className="tile-bottom">
          <span className="tile-author">@{file.author}</span>
          <div className="tile-actions">
            <button
              className="tile-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              title="copy link"
            >
              {copied ? "copied!" : "⌘ copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Lightbox({
  file,
  copied,
  onCopy,
  onClose,
}: {
  file: PublicFile;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const [dims, setDims] = useState<string>("—");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="lb-backdrop" onClick={onClose}>
      <div className="lb" onClick={(e) => e.stopPropagation()}>
        <div className="lb-img">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={file.url}
            alt={fileName(file.url)}
            onLoad={(e) => {
              const img = e.currentTarget;
              setDims(`${img.naturalWidth}×${img.naturalHeight}`);
            }}
          />
          {file.type === "image/gif" && (
            <div className="tile-badge lg">GIF · loop</div>
          )}
        </div>
        <aside className="lb-side">
          <div className="lb-head">
            <div className="lb-title">{fileName(file.url)}</div>
            <button className="lb-close" onClick={onClose}>
              ×
            </button>
          </div>
          <div className="lb-row">
            <div className="avatar small">
              <div className="avatar-inner" />
            </div>
            <div>
              <div className="lb-author">@{file.author}</div>
              <div className="lb-sub">posted {postedAgo(file._creationTime)}</div>
            </div>
          </div>

          <div className="lb-stats">
            <div>
              <span className="lb-k">size</span>
              <span className="lb-v">{formatBytes(file.size)}</span>
            </div>
            <div>
              <span className="lb-k">dims</span>
              <span className="lb-v">{dims}</span>
            </div>
            <div>
              <span className="lb-k">type</span>
              <span className="lb-v">{file.type.replace("image/", "")}</span>
            </div>
            <div>
              <span className="lb-k">posted</span>
              <span className="lb-v">
                {new Date(file._creationTime).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="lb-section-h">direct link</div>
          <div className="lb-url">
            <input readOnly value={file.url} onFocus={(e) => e.target.select()} />
            <button className="btn btn-primary small" onClick={onCopy}>
              {copied ? "copied" : "copy"}
            </button>
          </div>

          <div className="lb-actions">
            <a
              className="btn btn-ghost"
              href={file.url}
              download
              target="_blank"
              rel="noopener noreferrer"
            >
              ⤓ download
            </a>
          </div>

          <div className="lb-meta-foot">
            <span>id: {file._id.slice(0, 8)}</span>
            <span>hosted by 0016.cz</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="loader">
      <div className="loader-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span>loading more…</span>
    </div>
  );
}

function Footer() {
  return (
    <footer className="ftr">
      <div className="ftr-col">
        <div className="ftr-h">glypho</div>
        <div>public image collage</div>
        <div>part of 0016.cz</div>
      </div>
      <div className="ftr-col">
        <div className="ftr-h">host</div>
        <a href={MAIN_SITE_URL}>upload</a>
        <a href={`${MAIN_SITE_URL === "/" ? "" : MAIN_SITE_URL}/files`}>
          my files
        </a>
      </div>
      <div className="ftr-col">
        <div className="ftr-h">browse</div>
        <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>feed</a>
      </div>
      <div className="ftr-col">
        <div className="ftr-h">about</div>
        <a href={MAIN_SITE_URL}>0016.cz — file uploader</a>
      </div>
      <div className="ftr-col right">
        <div>status: all systems normal</div>
        <div className="status-dot" />
      </div>
    </footer>
  );
}
