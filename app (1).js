/* The library site. You shouldn't need to edit this file — your books and links live in books.js. */
(function () {
  "use strict";

  var PROFILE = window.PROFILE || {};
  var PREVIEW = !!window.SITE_PREVIEW;
  var GENRES = ["Romance", "Fantasy & Sci-Fi", "YA", "Thriller & Mystery", "Literary Fiction",
    "Classics", "Memoir", "History & Ideas", "Self-Help", "Faith", "Poetry"];
  var STATUS_LABEL = { read: "Read", reading: "Currently reading", tbr: "Owned. Intending." };
  var PLATFORMS = [
    { key: "tiktok", label: "TikTok" },
    { key: "instagram", label: "Instagram" },
    { key: "youtube", label: "YouTube" }
  ];
  /* muted, gallery-wall spine colours: [spine, lettering] */
  var PALETTE = [
    ["#2a2927", "#ebe6dc"], ["#c7cdc3", "#2b2f2a"], ["#9fb3c1", "#1d2830"], ["#d47fae", "#fff3f9"],
    ["#4eb19c", "#06221c"], ["#b4473a", "#fbe9e2"], ["#e9e5dc", "#2a2723"], ["#1f2b3e", "#dfe5ee"],
    ["#b7a24c", "#221d08"], ["#6b2335", "#f6dfe3"], ["#8b9095", "#f3f4f5"], ["#e4d2d8", "#3b2a30"],
    ["#3c4a3f", "#e3eadf"], ["#d45b38", "#fff1e8"], ["#a8c3cb", "#1b2a2e"], ["#5a4a6b", "#efe8f6"],
    ["#f3f1ec", "#3a3631"], ["#7a6a58", "#f4ece2"]
  ];

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* ---------- Books ---------- */
  var books = (window.BOOKS || []).filter(function (b) { return b && b.title; }).map(function (b, i) {
    var o = Object.assign({}, b);
    o.n = i + 1;
    o.title = String(b.title).trim();
    o.author = String(b.author || "").trim();
    o.genre = b.genre || "Other";
    o.status = b.read ? "read" : b.reading ? "reading" : "tbr";
    o.slug = slug(o.title);
    var h = hash(o.title + "|" + o.author);
    var pair = PALETTE[h % PALETTE.length];
    o.c1 = pair[0]; o.c2 = pair[1];
    o.v = (h >> 5) % 4;
    o.r = (((h >> 7) % 5) - 2) * 0.4; // slight lean, -0.8° to 0.8°
    o.s = (0.86 + ((h >> 11) % 15) / 100).toFixed(2); // books are different sizes
    return o;
  });
  var bySlug = {};
  books.forEach(function (b) { if (!bySlug[b.slug]) bySlug[b.slug] = b; });
  function findByTitle(t) { return bySlug[slug(t || "")] || null; }
  var readBooks = books.filter(function (b) { return b.status === "read"; });
  var readingBooks = books.filter(function (b) { return b.status === "reading"; });

  /* ---------- Posts & embeds ---------- */
  function postsFor(b) {
    var list = [];
    PLATFORMS.forEach(function (p) { if (b[p.key]) list.push({ key: p.key, label: p.label, url: b[p.key] }); });
    if (b.other) list.push({ key: "other", label: b.otherLabel || "Other link", url: b.other });
    return list;
  }
  function embedFor(key, url) {
    try {
      var u = new URL(url);
      if (key === "youtube") {
        if (u.pathname.indexOf("/shorts/") === 0) return { src: "https://www.youtube-nocookie.com/embed/" + u.pathname.split("/")[2], kind: "tall" };
        var id = u.hostname.indexOf("youtu.be") > -1 ? u.pathname.slice(1) : u.searchParams.get("v");
        if (id) return { src: "https://www.youtube-nocookie.com/embed/" + id, kind: "wide" };
      }
      if (key === "tiktok") {
        var t = u.pathname.match(/\/video\/(\d+)/);
        if (t) return { src: "https://www.tiktok.com/embed/v2/" + t[1], kind: "tall" };
      }
      if (key === "instagram") {
        var m = u.pathname.match(/\/(p|reel|reels|tv)\/([\w-]+)/);
        if (m) return { src: "https://www.instagram.com/" + (m[1] === "reels" ? "reel" : m[1]) + "/" + m[2] + "/embed", kind: "ig" };
      }
    } catch (e) { /* not a full link */ }
    return null;
  }

  /* ---------- Covers (Open Library, looked up once per browser, then remembered) ---------- */
  var CACHE_KEY = "library-covers-v3";
  var coverCache = {};
  try { coverCache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch (e) { coverCache = {}; }
  var saveTimer = null;
  function saveCache() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { try { localStorage.setItem(CACHE_KEY, JSON.stringify(coverCache)); } catch (e) { /* storage off */ } }, 400);
  }
  var pending = {};
  var queue = [], active = 0, MAX_ACTIVE = 4;
  function pump() {
    while (active < MAX_ACTIVE && queue.length) {
      var job = queue.shift();
      active++;
      job().then(function () { active--; pump(); });
    }
  }
  function findCover(b) {
    if (b.cover) return Promise.resolve(b.cover);
    if (PREVIEW) return Promise.resolve(null);
    var key = (b.title + "|" + b.author).toLowerCase();
    if (key in coverCache) return Promise.resolve(coverCache[key]);
    if (pending[key]) return pending[key];
    var shortTitle = b.title.split(":")[0].replace(/[’']/g, "'").trim();
    var firstAuthor = b.author.split(/&|,/)[0].replace(/\(.*?\)/g, "").trim();
    /* try a few searches, from most to least specific, and take the first result that has a cover */
    var searches = [
      { title: shortTitle, author: firstAuthor },
      { q: shortTitle + " " + firstAuthor },
      { title: shortTitle }
    ];
    function search(params, tries) {
      var p = new URLSearchParams(params);
      p.set("limit", "8");
      p.set("fields", "cover_i");
      return fetch("https://openlibrary.org/search.json?" + p.toString()).then(function (r) {
        if ((r.status === 429 || r.status >= 500) && tries > 0) {
          return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return search(params, tries - 1); });
        }
        if (!r.ok) throw new Error("lookup failed");
        return r.json().then(function (j) {
          var hit = (j.docs || []).filter(function (d) { return d.cover_i; })[0];
          return hit ? hit.cover_i : null;
        });
      });
    }
    /* Google Books first: it usually has the current publisher edition */
    function googleCover(tries) {
      var q = 'intitle:"' + shortTitle.replace(/"/g, "") + '"' + (firstAuthor ? ' inauthor:"' + firstAuthor.replace(/"/g, "") + '"' : "");
      var p = new URLSearchParams({ q: q, printType: "books", maxResults: "10", langRestrict: "en" });
      return fetch("https://www.googleapis.com/books/v1/volumes?" + p.toString()).then(function (r) {
        if ((r.status === 429 || r.status >= 500) && tries > 0) {
          return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return googleCover(tries - 1); });
        }
        if (!r.ok) return null;
        return r.json().then(function (j) {
          var items = (j.items || []).filter(function (it) {
            var v = it.volumeInfo || {};
            return v.imageLinks && v.imageLinks.thumbnail;
          });
          if (!items.length) return null;
          var link = items[0].volumeInfo.imageLinks.thumbnail;
          // larger, uncurled image from the same source
          return link.replace(/^http:/, "https:").replace("&edge=curl", "").replace(/&zoom=\d/, "&zoom=1") + "&fife=w600-h900";
        });
      }).catch(function () { return null; });
    }
    pending[key] = new Promise(function (resolve) {
      queue.push(function () {
        var i = 0;
        function next() {
          if (i >= searches.length) return Promise.resolve(null);
          return search(searches[i++], 2).then(function (id) { return id || next(); });
        }
        function openLibrary() {
          return next().then(function (id) { return id ? "https://covers.openlibrary.org/b/id/" + id + "-M.jpg" : null; });
        }
        return googleCover(2)
          .then(function (url) { return url || openLibrary(); })
          .then(function (url) {
            coverCache[key] = url; saveCache();
            resolve(url);
          })
          .catch(function () { resolve(null); }); // network trouble: don't remember, try again next visit
      });
      pump();
    });
    return pending[key];
  }
  function attachImage(el, url, cls) {
    var img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.onload = function () {
      if (img.naturalWidth > 2 && !el.querySelector("img")) {
        // let each real cover keep its own shape (some books are squarer or taller)
        var ratio = Math.min(0.85, Math.max(0.6, img.naturalWidth / img.naturalHeight));
        el.style.aspectRatio = ratio.toFixed(3);
        el.prepend(img);
        el.classList.add(cls);
      }
    };
    img.onerror = function () {
      // if the large Google image isn't available, use the standard one
      if (url.indexOf("&fife=") > -1) attachImage(el, url.replace(/&fife=[^&]*/, ""), cls);
    };
    img.src = url;
  }
  var observer = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      observer.unobserve(en.target);
      var b = books[Number(en.target.getAttribute("data-n")) - 1];
      var art = en.target.querySelector(".cover-art");
      findCover(b).then(function (url) { if (url) attachImage(art, url, "has-img"); });
    });
  }, { root: $("shelfScroll"), rootMargin: "0px 1200px" }) : null;

  /* ---------- Masthead ---------- */
  var name = PROFILE.name || "My Library";
  $("eyebrow").textContent = PROFILE.eyebrow || "A personal library";
  $("footerName").textContent = name;
  document.title = name + " Library";
  var headline = PROFILE.headline || "Welcome to my library";
  $("headline").textContent = headline;
  if (!PREVIEW && !reduceMotion) {
    var el = $("headline"), i = 0;
    el.textContent = "";
    (function type() {
      el.textContent = headline.slice(0, ++i);
      if (i < headline.length) setTimeout(type, 55 + Math.random() * 60);
    })();
  }

  var recommend = PROFILE.recommend || PROFILE.instagram;
  if (recommend) { $("recommend").href = recommend; $("recommend").hidden = false; }

  $("socials").innerHTML = PLATFORMS.filter(function (p) { return PROFILE[p.key]; }).map(function (p) {
    return '<a href="' + esc(PROFILE[p.key]) + '" target="_blank" rel="noopener">' + p.label + " ↗</a>";
  }).join("");
  $("socials").hidden = !$("socials").innerHTML;

  if (PREVIEW) {
    var banner = document.createElement("p");
    banner.className = "preview-banner";
    banner.textContent = "Preview. Your photographed covers show here; the rest fill in automatically on the live site, where videos also play.";
    document.querySelector("main").prepend(banner);
  }

  /* ---------- Shelf ---------- */
  var state = { view: readBooks.length ? "read" : "all", genre: "All", q: "" };

  function renderViews() {
    var html = "";
    if (readBooks.length) {
      html += '<button type="button" data-view="read" aria-pressed="' + (state.view === "read") + '">' + readBooks.length + " read</button><span aria-hidden=\"true\">·</span>";
    }
    html += '<button type="button" data-view="all" aria-pressed="' + (state.view === "all") + '">' + books.length + " volumes</button>";
    $("views").innerHTML = html;
  }
  function inView() {
    return state.view === "read" ? readBooks : books;
  }
  function renderChips() {
    var c = {};
    inView().forEach(function (b) { c[b.genre] = (c[b.genre] || 0) + 1; });
    if (state.genre !== "All" && !c[state.genre]) state.genre = "All";
    var list = ["All"].concat(GENRES.filter(function (g) { return c[g]; }))
      .concat(Object.keys(c).filter(function (g) { return GENRES.indexOf(g) === -1; }));
    $("genreChips").innerHTML = list.length > 2 ? list.map(function (g) {
      return '<button class="chip" type="button" data-genre="' + esc(g) + '" aria-pressed="' + (g === state.genre) + '">' + esc(g) + "</button>";
    }).join("") : "";
  }
  function visible() {
    var q = state.q;
    return inView().filter(function (b) {
      return (state.genre === "All" || b.genre === state.genre) &&
        (!q || (b.title + " " + b.author).toLowerCase().indexOf(q) > -1);
    });
  }
  function bookHTML(b) {
    return '<button class="book" type="button" data-open="' + b.slug + '" data-n="' + b.n + '" id="book-' + b.n +
      '" style="--r:' + b.r + "deg;--s:" + b.s + '" title="' + esc(b.title + " — " + b.author) + '" aria-label="' +
      esc(b.title + " by " + b.author + ", " + STATUS_LABEL[b.status]) + '">' + coverArt(b) +
      (state.view === "all" && b.status === "read" ? '<span class="ribbon" aria-hidden="true"></span>' : "") + "</button>";
  }
  function renderShelf() {
    var list = visible();
    var row = $("shelfRow");
    if (list.length) {
      row.innerHTML = list.map(bookHTML).join("");
    } else {
      row.innerHTML = '<p class="shelf-empty">' + (state.q ? "Nothing by that name. I'd remember." : "Nothing here yet.") + "</p>";
    }
    row.classList.toggle("few", list.length < 4);
    $("shelfScroll").scrollLeft = 0;
    if (observer) {
      observer.disconnect();
      row.querySelectorAll(".book").forEach(function (s) { observer.observe(s); });
    } else {
      list.forEach(function (b) {
        findCover(b).then(function (url) { var s = $("book-" + b.n); if (url && s) attachImage(s.querySelector(".cover-art"), url, "has-img"); });
      });
    }
    renderFoot();
  }

  /* scroll the shelf sideways with a normal mouse wheel */
  $("shelfScroll").addEventListener("wheel", function (e) {
    var s = e.currentTarget;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var max = s.scrollWidth - s.clientWidth;
    if (max <= 0) return;
    if ((e.deltaY > 0 && s.scrollLeft < max - 1) || (e.deltaY < 0 && s.scrollLeft > 0)) {
      s.style.scrollBehavior = "auto";
      s.scrollLeft += e.deltaY;
      s.style.scrollBehavior = "";
      e.preventDefault();
    }
  }, { passive: false });
  function renderFoot() {
    var bits = [];
    if (readingBooks.length) {
      bits.push("Currently reading · " + readingBooks.map(function (b) {
        return '<button type="button" data-open="' + b.slug + '">' + esc(b.title) + "</button>";
      }).join(", "));
    } else if (state.view === "all") {
      bits.push("A ribbon means I've read it");
    }
    $("footLeft").innerHTML = bits.join("");
    $("pickButton").hidden = state.view !== "all";
  }
  function renderAll() { renderViews(); renderChips(); renderShelf(); }
  renderAll();

  $("views").addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]");
    if (!b || b.getAttribute("data-view") === state.view) return;
    state.view = b.getAttribute("data-view");
    renderAll();
  });
  $("genreChips").addEventListener("click", function (e) {
    var chip = e.target.closest("[data-genre]");
    if (!chip) return;
    state.genre = chip.getAttribute("data-genre");
    renderChips(); renderShelf();
  });
  $("searchInput").addEventListener("input", function (e) { state.q = e.target.value.trim().toLowerCase(); renderShelf(); });

  /* ---------- Pick my next read ---------- */
  $("pickButton").addEventListener("click", function () {
    var pool = visible().filter(function (b) { return b.status === "tbr"; });
    if (!pool.length) pool = books.filter(function (b) { return b.status === "tbr"; });
    if (!pool.length) return;
    var b = pool[Math.floor(Math.random() * pool.length)];
    var el = $("book-" + b.n);
    if (!el) { state.genre = "All"; state.q = ""; $("searchInput").value = ""; renderChips(); renderShelf(); el = $("book-" + b.n); }
    document.querySelectorAll(".book.picked").forEach(function (s) { s.classList.remove("picked"); });
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
    el.classList.add("picked");
    setTimeout(function () { openBook(b, "The shelf has chosen"); }, reduceMotion ? 0 : 1200);
  });

  /* ---------- Book card ---------- */
  var dialog = $("bookDialog");
  function coverArt(b) {
    return '<div class="cover-art cv' + b.v + '" style="--c1:' + b.c1 + ";--c2:" + b.c2 + '"><div class="cover-fallback"><b>' + esc(b.title) +
      "</b><span>" + esc(b.author) + "</span></div></div>";
  }
  function setPost(post) {
    var area = $("postArea");
    var em = PREVIEW ? null : embedFor(post.key, post.url);
    var html = "";
    if (em) {
      html += '<div class="embed ' + em.kind + '"><iframe src="' + esc(em.src) + '" title="' + esc(post.label + " post") +
        '" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>';
    } else if (PREVIEW && post.key !== "other") {
      html += '<p class="note">On the live site, the ' + esc(post.label) + " post plays here.</p>";
    }
    html += '<a class="open-link" href="' + esc(post.url) + '" target="_blank" rel="noopener">Open on ' + esc(post.label) + " ↗</a>";
    area.innerHTML = html;
    $("cardPosts").querySelectorAll(".post-tab").forEach(function (t) {
      t.setAttribute("aria-pressed", String(t.getAttribute("data-key") === post.key));
    });
  }
  function openBook(b, eyebrow) {
    if (!b) return;
    $("cardEyebrow").textContent = eyebrow || ("No. " + String(b.n).padStart(3, "0") + " · " + b.genre);
    $("cardTitle").textContent = b.title;
    $("cardAuthor").textContent = b.author;
    $("cardCover").innerHTML = coverArt(b);
    var art = $("cardCover").firstChild;
    findCover(b).then(function (url) { if (url) attachImage(art, url.replace("-M.jpg", "-L.jpg"), "has-img"); });

    $("cardVerdict").innerHTML = (b.verdict ? '<div class="stamp">' + esc(b.verdict) + "</div>" : "") +
      (b.review ? '<p class="review">' + esc(b.review) + "</p>" : "");
    $("cardVerdict").hidden = !b.verdict && !b.review;

    var rows = [["Status", esc(STATUS_LABEL[b.status])], ["Genre", esc(b.genre)]];
    if (b.finished) rows.push(["Finished", esc(b.finished)]);
    var also = findByTitle(b.alsoTry);
    if (also && also !== b) rows.push(["Also try", '<button class="also-try" type="button" data-open="' + also.slug + '">' + esc(also.title) + "</button>"]);
    $("cardRows").innerHTML = rows.map(function (r) { return "<dt>" + r[0] + "</dt><dd>" + r[1] + "</dd>"; }).join("");

    var posts = postsFor(b);
    var box = $("cardPosts");
    if (posts.length) {
      box.innerHTML = '<div class="eyebrow">What I posted</div>' +
        (posts.length > 1 ? '<div class="post-tabs">' + posts.map(function (p) {
          return '<button class="post-tab" type="button" data-key="' + p.key + '" aria-pressed="false">' + esc(p.label) + "</button>";
        }).join("") + "</div>" : "") +
        '<div class="post-area" id="postArea"></div>';
      box.querySelectorAll(".post-tab").forEach(function (t, i) { t.addEventListener("click", function () { setPost(posts[i]); }); });
      setPost(posts[0]);
    } else {
      box.innerHTML = '<p class="note">' + (b.status === "tbr" ? "Not read yet. No posts, no opinions. Yet." :
        b.status === "reading" ? "Still reading. Opinions forming quietly." : "Nothing posted on this one yet.") + "</p>";
    }
    try { history.replaceState(null, "", "#" + b.slug); } catch (e) { /* ignore */ }
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }
  dialog.addEventListener("close", function () {
    $("cardPosts").innerHTML = ""; // stops any playing video
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
  });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
  $("closeCard").addEventListener("click", function () { dialog.close(); });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-open]");
    if (t) openBook(bySlug[t.getAttribute("data-open")]);
  });

  function fromHash() {
    var h = decodeURIComponent((location.hash || "").slice(1));
    if (h && bySlug[h]) openBook(bySlug[h]);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();
