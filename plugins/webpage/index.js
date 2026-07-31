const SIDEBAR_CSS = `
    html {
      scroll-behavior: smooth;
    }

    #toc-sidebar {
      position: fixed;
      top: 0;
      left: 0;
      width: 260px;
      height: 100vh;
      overflow-y: auto;
      box-sizing: border-box;
      padding: 20px 16px;
      background: #F5F5F7;
      border-right: 1px solid #E0E0E2;
      font-family: Arial, sans-serif;
    }

    #toc-sidebar h2 {
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6E6F75;
      margin: 0 0 12px 0;
    }

    #toc-sidebar ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    #toc-sidebar li {
      margin: 0;
    }

    #toc-sidebar a {
      display: block;
      padding: 4px 0 4px 8px;
      text-decoration: none;
      color: #131315;
      font-size: 13px;
      line-height: 1.3;
      border-left: 2px solid transparent;
    }

    #toc-sidebar a:hover {
      color: #FF0F7B;
    }

    #toc-sidebar a.toc-active {
      color: #FF0F7B;
      border-left-color: #FF0F7B;
      font-weight: bold;
    }

    #toc-sidebar .toc-level-1 > a {
      font-weight: bold;
      font-size: 14px;
    }

    #toc-sidebar .toc-level-2 {
      padding-left: 12px;
    }

    #toc-sidebar .toc-level-3 {
      padding-left: 24px;
    }

    #toc-sidebar .toc-level-3 > a {
      font-size: 12px;
      color: #6E6F75;
    }

    body .section {
      margin-left: 300px;
      padding: 0 24px;
    }

    @media (max-width: 900px) {
      #toc-sidebar {
        display: none;
      }

      body .section {
        margin-left: 0;
      }
    }

    pre {
      position: relative;
    }

    pre.hljs {
      position: relative;
    }

    .copy-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 2px 8px;
      font-size: 11px;
      font-family: Arial, sans-serif;
      background: #444;
      color: #eee;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s;
    }

    pre.hljs:hover .copy-btn,
    pre:hover .copy-btn {
      opacity: 1;
    }

    .copy-btn:active,
    .copy-btn.copied {
      background: #FF0F7B;
      color: #fff;
    }
`;

const SIDEBAR_NAV = `  <nav id="toc-sidebar" aria-label="Table of contents">
    <h2>Contents</h2>
    <ul id="toc-list"></ul>
  </nav>`;

const SCRIPTS = `  <script>
    (function () {
      var sidebar = document.getElementById('toc-sidebar');
      var headings = Array.prototype.filter.call(
        document.querySelectorAll('h1, h2, h3'),
        function (h) { return !sidebar.contains(h); }
      );
      var tocList = document.getElementById('toc-list');
      var usedIds = {};
      var items = [];

      headings.forEach(function (heading) {
        var id = heading.id;
        if (!id) return;
        if (usedIds[id]) {
          usedIds[id] += 1;
          id = id + '-' + usedIds[id];
          heading.id = id;
        } else {
          usedIds[id] = 1;
        }

        var level = parseInt(heading.tagName.substring(1), 10);
        var li = document.createElement('li');
        li.className = 'toc-level-' + level;
        var a = document.createElement('a');
        a.href = '#' + id;
        a.textContent = heading.textContent;
        li.appendChild(a);
        tocList.appendChild(li);
        items.push({ id: id, link: a });
      });

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var match = items.find(function (item) { return item.id === entry.target.id; });
          if (!match) return;
          items.forEach(function (item) { item.link.classList.remove('toc-active'); });
          match.link.classList.add('toc-active');
        });
      }, { rootMargin: '0px 0px -70% 0px' });

      headings.forEach(function (heading) { observer.observe(heading); });
    })();

    document.querySelectorAll('pre').forEach(function (pre) {
      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', function () {
        var code = pre.querySelector('code');
        navigator.clipboard.writeText(code ? code.textContent : pre.textContent).then(function () {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        });
      });
      pre.appendChild(btn);
    });
  </script>`;

export function postProcessHtml(html) {
    html = html.replace('</style>', SIDEBAR_CSS + '\n  </style>');
    html = html.replace(/(<body[^>]*>)/, '$1\n' + SIDEBAR_NAV);
    html = html.replace('</body>', SCRIPTS + '\n</body>');
    return html;
}

export default {
    name: 'webpage',
    version: '1.0.0',
    hooks: {
        outputMode: 'html',
        postProcessHtml,
    },
};
