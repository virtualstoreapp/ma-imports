(function () {
  // Prevent reinitialization (except in test mode)
  if (window.__catalogInitialized && !window.__isTest) return;
  window.__catalogInitialized = true;

  // --- Constants ---
  const WHATSAPP_NUMBER = '5519999762594';
  const ALL_CATEGORY = 'all';

  // Category identity lives in catalog/categories.json and is injected into
  // index.html by tools/sync-registry.js. Reading it here replaced a hand-kept
  // CATEGORIES_DICT that had to stay in step with both the products/ filenames
  // and the nav markup, with only the first pair ever cross-checked.
  const readCategoryRegistry = () => {
    // Enough to keep the homepage rendering if the block is missing: the merged
    // catalog is one request and does not depend on the leaf list.
    const fallback = { labels: { [ALL_CATEGORY]: 'Novidades' }, leaves: [], aliases: {} };

    const element = document.getElementById('category-registry');
    if (!element) {
      console.error('Category registry block is missing from index.html; run `node tools/sync-registry.js`.');
      return fallback;
    }

    try {
      const parsed = JSON.parse(element.textContent);
      return {
        labels: parsed.labels && typeof parsed.labels === 'object' ? parsed.labels : fallback.labels,
        leaves: Array.isArray(parsed.leaves) ? parsed.leaves : [],
        aliases: parsed.aliases && typeof parsed.aliases === 'object' ? parsed.aliases : {},
      };
    } catch (error) {
      console.error('Category registry block is not valid JSON:', error);
      return fallback;
    }
  };

  const REGISTRY = readCategoryRegistry();

  // Both maps come from parsed JSON, so every lookup against them uses
  // hasOwnProperty rather than plain indexing — see categoryFromHash.
  const CATEGORY_LABELS = REGISTRY.labels;
  const CATEGORY_ALIASES = REGISTRY.aliases;

  const ownProperty = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  // --- Helper Functions ---
  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);

  // Product data is interpolated into markup, so every value is escaped for both
  // text and quoted-attribute contexts before it reaches innerHTML.
  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Returns the build-generated media entry for an image index, when available.
  const mediaAt = (product, index) =>
    (Array.isArray(product.media) ? product.media[index] : null) || null;

  // Grid cards prefer the generated WebP thumbnail and declare their intrinsic
  // size so the layout never shifts. An unbuilt tree falls back to the original.
  const cardMediaMarkup = (product) => {
    const alt = escapeHtml(product.name);
    const media = mediaAt(product, 0);
    if (!media) {
      // No media means an unbuilt source tree, where the original is all there
      // is. The legacy singular `image` field is gone: every product has used
      // `images[]` since Wave 0, and the schema rejects the old key.
      const fallback = (product.images || [])[0];
      return `<img src="${escapeHtml(fallback)}" alt="${alt}" loading="lazy" decoding="async">`;
    }
    return `<picture>
            <source srcset="${escapeHtml(media.thumb)}" type="image/webp">
            <img src="${escapeHtml(media.thumbFallback)}" alt="${alt}" width="${escapeHtml(media.thumbWidth)}" height="${escapeHtml(media.thumbHeight)}" loading="lazy" decoding="async">
          </picture>`;
  };

  // A row can hold several units, each independently sellable, so the card shows
  // which sizes are actually left rather than one all-or-nothing badge. This is
  // the question a customer asks most often — "do you have it in G?" — and the
  // data could not answer it before the v2 size model.
  //
  // `sizeNote` renders in place of the sizes, without the "Tamanho:" prefix: the
  // notes are things like "Consultar" and "Tamanho único", which read as
  // nonsense prefixed ("Tamanho: Consultar") and fine on their own.
  const sizesMarkup = (product) => {
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];

    if (sizes.length) {
      const label = sizes.length > 1 ? 'Tamanhos' : 'Tamanho';
      const chips = sizes
        .map((unit) => {
          const size = escapeHtml(unit.size);
          return unit.soldOut === true
            ? `<span class="size-chip size-chip-sold-out" aria-label="${size} (esgotado)">${size}</span>`
            : `<span class="size-chip">${size}</span>`;
        })
        .join('');
      return `<p class="sizes"><span class="size-label">${label}:</span>${chips}</p>`;
    }

    if (product.sizeNote) {
      return `<p class="size-note">${escapeHtml(product.sizeNote)}</p>`;
    }

    // A cap or a wallet has no meaningful size; v1 rendered "N/A" here.
    return '';
  };

  const updateCategoryHeading = (category, headingEl) => {
    headingEl.textContent = ownProperty(CATEGORY_LABELS, category)
      ? CATEGORY_LABELS[category]
      : 'Produtos';
  };

  const collapseAllSubmenus = () => {
    document.querySelectorAll('nav button.has-submenu, nav li.has-submenu > button')
      .forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
        const submenu = button.nextElementSibling;
        if (submenu && submenu.classList.contains('submenu')) {
          if (window.innerWidth <= 768) {
            submenu.classList.remove('open');
          } else {
            submenu.style.display = 'none';
          }
        }
      });
  };

  // --- Modal Module ---
  const Modal = (() => {
    let modal, currentImages = [], currentIndex = 0, currentZoom = 1;
    let currentProductName = '', currentCategory = '', currentProduct = null;

    // Set by the catalog module, which owns the URL fragment.
    let onProductOpen = null;
    let onProductClose = null;

    /**
     * Registers the fragment callbacks.
     * @param {object} handlers Open and close handlers.
     */
    const onNavigate = ({ opened, closed }) => {
      onProductOpen = opened;
      onProductClose = closed;
    };

    /** @returns {object|null} The product currently on screen, if any. */
    const currentlyOpen = () => currentProduct;

    // Build modal HTML markup.
    const createModalMarkup = () => `
      <div id="modal-content">
        <button id="modal-close">X</button>
        <div id="modal-image-container" class="modal-image-container">
          <picture>
            <source id="modal-image-source" type="image/webp">
            <img id="modal-image" src="" alt="">
          </picture>
        </div>
        <div id="modal-controls">
          <button id="prev-image">&lt;</button>
          <button id="zoom-out">-</button>
          <button id="copy-product-id">ID</button>
          <button id="zoom-in">+</button>
          <button id="next-image">&gt;</button>
          <button id="buy-product">Comprar</button>
        </div>
      </div>
    `;

    // Bind modal event handlers.
    const bindModalEvents = () => {
      document.getElementById('modal-close').addEventListener('click', close);
      document.getElementById('prev-image').addEventListener('click', showPrev);
      document.getElementById('next-image').addEventListener('click', showNext);
      document.getElementById('zoom-in').addEventListener('click', () => adjustZoom(0.2));
      document.getElementById('zoom-out').addEventListener('click', () => adjustZoom(-0.2));

      document.getElementById('copy-product-id').addEventListener('click', () => {
        if (currentProductName) {
          const message = `Categoria: ${currentCategory}, ID do Produto: ${currentProductName}`;
          navigator.clipboard.writeText(message)
            .then(() => {
              alert('ID copiado!');
            })
            .catch(err => {
              console.error('Falha ao copiar o ID:', err);
              alert('Erro ao copiar. Tente novamente.');
            });
        }
      });

      document.getElementById('buy-product').addEventListener('click', () => {
        const message = `Olá, acabei de conferir seu catálogo online e na categoria ${currentCategory}, me interessei pelo produto ${currentProductName}. Poderia, por favor, me enviar mais informações e confirmar a disponibilidade? Obrigado!`;
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        if (window.gtag) {
          gtag('event', 'buy_product', {
            event_category: 'Modal',
            event_label: currentProductName,
            product_category: currentCategory,
          });
        }
        window.open(url, '_blank');
      });
      modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
      });
    };

    const updateImage = () => {
      const modalImage = document.getElementById('modal-image');
      const modalSource = document.getElementById('modal-image-source');
      const media = mediaAt(currentProduct, currentIndex);

      // The <source> carries the generated WebP; the <img> is the fallback for
      // browsers that cannot decode it. That fallback is now a generated 1200px
      // JPEG rather than the original, which is no longer copied into dist/.
      // An unbuilt source tree has no media, so it falls back to the original.
      if (modalSource) {
        if (media) modalSource.setAttribute('srcset', media.webp);
        else modalSource.removeAttribute('srcset');
      }
      modalImage.src = (media && media.full) || currentImages[currentIndex];
      modalImage.style.transform = `scale(${currentZoom})`;
    };

    const updateNavButtons = () => {
      const prevBtn = document.getElementById('prev-image');
      const nextBtn = document.getElementById('next-image');
      const disableNav = currentImages.length < 2;
      prevBtn.disabled = disableNav;
      nextBtn.disabled = disableNav;
    };

    // Open modal with product data. Applies soldOut logic.
    const open = (product, categoryText) => {
      currentImages = Array.isArray(product.images) ? product.images : [product.image];
      currentIndex = 0;
      currentZoom = 1;
      currentProduct = product;
      currentProductName = product.name;
      currentCategory = categoryText;
      updateImage();
      updateNavButtons();

      // Derived by the build from the units, and omitted when false.
      const isSoldOut = product.soldOut === true;
      const buyButton = document.getElementById('buy-product');
      const modalImageContainer = document.getElementById('modal-image-container');

      // Remove previous sold-out label if it exists.
      const existingLabel = modalImageContainer.querySelector('.sold-out-label');
      if (existingLabel) existingLabel.remove();

      if (isSoldOut) {
        const label = document.createElement('div');
        label.id = 'sold-out-label';
        label.className = 'sold-out-label';
        label.textContent = 'Esgotado';
        modalImageContainer.appendChild(label);
        buyButton.disabled = true;
      } else {
        buyButton.disabled = false;
      }

      modal.style.display = 'flex';

      // An open product is a shareable URL (CON-11). Writing the fragment here
      // means the browser's own share and copy-link actions carry the product,
      // with no extra UI. onProductOpen is supplied by the catalog module, which
      // owns the fragment.
      if (typeof onProductOpen === 'function') onProductOpen(product);

      if (window.gtag) {
        gtag('event', 'open_modal', {
          event_category: 'Product',
          event_label: currentProductName,
        });
      }
    };

    const close = () => {
      modal.style.display = 'none';
      currentProduct = null;
      // Hand the fragment back to the category, so closing the modal does not
      // leave a product URL pointing at a closed modal.
      if (typeof onProductClose === 'function') onProductClose();
    };

    const showPrev = () => {
      if (currentImages.length > 1) {
        currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
        currentZoom = 1;
        updateImage();
        if (window.gtag) {
          gtag('event', 'navigate_image', {
            event_category: 'Modal',
            event_label: 'prev',
            product: currentProductName,
          });
        }
      }
    };

    const showNext = () => {
      if (currentImages.length > 1) {
        currentIndex = (currentIndex + 1) % currentImages.length;
        currentZoom = 1;
        updateImage();
        if (window.gtag) {
          gtag('event', 'navigate_image', {
            event_category: 'Modal',
            event_label: 'next',
            product: currentProductName,
          });
        }
      }
    };

    const adjustZoom = (delta) => {
      currentZoom = Math.max(0.2, currentZoom + delta);
      updateImage();
      if (window.gtag) {
        const action = delta > 0 ? 'zoom_in' : 'zoom_out';
        gtag('event', action, {
          event_category: 'Modal',
          event_label: currentProductName,
          zoom: currentZoom,
        });
      }
    };

    const init = () => {
      modal = document.createElement('div');
      modal.id = 'product-modal';
      modal.innerHTML = createModalMarkup();
      document.body.appendChild(modal);
      bindModalEvents();
    };

    return { init, open, close, onNavigate, currentlyOpen };
  })();

  // --- Catalog Module ---
  const Catalog = (() => {
    const categoryButtons = document.querySelectorAll('nav button[data-category]');
    const productListContainer = document.getElementById('product-list');
    const categoryHeading = document.getElementById('category-heading');

    // Category currently on screen, used to ignore redundant hash navigation.
    let renderedCategory = null;

    // Incremented per render so a slower earlier render cannot append over a
    // newer one. See renderProducts.
    let renderToken = 0;

    // The products currently on screen, so a #p/{id} link can find one without
    // a second fetch.
    let renderedProducts = [];

    // Newest first. Products carry an explicit UTC `listedAt`, so this replaced
    // a regex that recovered the date from the display name — one of two
    // duplicate implementations, both using local-time construction, so the
    // reader's timezone could reorder products that shared a minute.
    const listedAtOf = (product) => {
      const parsed = Date.parse(product.listedAt);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    // Fetch and parse one category file.
    const fetchCategoryFile = async (category) => {
      const response = await fetch(`products/${category}.json`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${category} (HTTP ${response.status})`);
      }
      return response.json();
    };

    // Merge every category client-side, degrading per category so one missing
    // file no longer blanks the whole homepage.
    const mergeAllCategories = async () => {
      const categories = REGISTRY.leaves;
      const settled = await Promise.allSettled(categories.map(fetchCategoryFile));
      const products = settled.flatMap((result, idx) => {
        if (result.status === 'rejected') {
          console.error(`Skipping ${categories[idx]}:`, result.reason);
          return [];
        }
        return result.value.map((product) => ({ ...product, category: categories[idx] }));
      });
      return products.sort((a, b) => listedAtOf(b) - listedAtOf(a));
    };

    // Fetch product data for a given category. The build emits a pre-merged,
    // pre-sorted products/all.json so the homepage costs a single request; an
    // unbuilt source tree falls back to merging the categories in the browser.
    const fetchCategoryData = async (category) => {
      if (category === ALL_CATEGORY) {
        try {
          return await fetchCategoryFile(ALL_CATEGORY);
        } catch (error) {
          console.warn('Merged catalog unavailable, merging categories:', error.message);
          return mergeAllCategories();
        }
      }

      try {
        return await fetchCategoryFile(category);
      } catch (error) {
        console.error(`Error fetching data for ${category}:`, error);
        return [];
      }
    };

    // Render product items based on selected category.
    //
    // The grid is cleared synchronously but filled after an await, so two
    // overlapping renders would both clear and then both append, leaving a grid
    // holding both categories. Each render takes a token and drops out if a
    // newer one started while it was fetching.
    const renderProducts = async (category) => {
      const token = (renderToken += 1);
      productListContainer.innerHTML = '';
      updateCategoryHeading(category, categoryHeading);
      const products = await fetchCategoryData(category);
      if (token !== renderToken) return;
      products.forEach((product) => {
        const li = document.createElement('li');
        li.classList.add('product-item');
        li.style.position = 'relative'; // For sold-out label positioning

        const priceHTML = product.oldPrice && product.oldPrice > 0
          ? `<span class="old-price">${formatCurrency(product.oldPrice)}</span>
             <span class="new-price">${formatCurrency(product.price)}</span>`
          : `<span class="price">${formatCurrency(product.price)}</span>`;

        li.innerHTML = `
          ${cardMediaMarkup(product)}
          <div class="product-details">
            <h3>${escapeHtml(product.name)}</h3>
            ${product.description ? `<p class="description">${escapeHtml(product.description)}</p>` : ''}
            ${sizesMarkup(product)}
            ${priceHTML}
          </div>
        `;

        // The row-level flag is derived by the build from the units, so the
        // client no longer re-derives it defensively.
        if (product.soldOut === true) {
          const label = document.createElement('div');
          label.className = 'sold-out-label';
          label.textContent = 'Esgotado';
          li.appendChild(label);
        }

        li.addEventListener('click', () => {
          if (window.gtag) {
            gtag('event', 'product_click', {
              event_category: 'Product',
              event_label: product.name,
            });
          }
          // On the homepage the heading reads "Novidades"; the merged catalog
          // carries each product's real category, so WhatsApp gets that instead.
          Modal.open(
            product,
            ownProperty(CATEGORY_LABELS, product.category)
              ? CATEGORY_LABELS[product.category]
              : categoryHeading.textContent
          );
        });

        productListContainer.appendChild(li);
      });
      renderedCategory = category;
      renderedProducts = products;

      // A product fragment is more specific than the category behind it, so
      // rendering the grid must not overwrite it — that would break a shared
      // link by replacing #p/{id} with #all before the modal could open.
      if (!productIdFromHash() && window.location.hash.slice(1) !== category) {
        window.location.hash = category;
      }
    };

    /** @returns {string} The raw fragment, or '' when it cannot be decoded. */
    const rawHash = () => {
      try {
        return decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return '';
      }
    };

    // A product deep link. `p/` cannot collide with a category, because every
    // category slug is [a-z0-9-] and carries no slash.
    const PRODUCT_HASH = /^p\/(\d{10})$/;

    /**
     * Reads a product id out of the fragment.
     *
     * The id is matched against a fixed 10-digit shape and then looked up in the
     * rendered catalog — never used to index anything directly. Same discipline
     * as categoryFromHash: the fragment is untrusted.
     * @returns {string|null} The id, or null when the fragment is not one.
     */
    const productIdFromHash = () => {
      const match = PRODUCT_HASH.exec(rawHash());
      return match ? match[1] : null;
    };

    // The fragment is untrusted, so only known categories are honoured. Both
    // lookups go through hasOwnProperty: the registry is parsed JSON, so a
    // fragment of "#__proto__" or "#constructor" would otherwise resolve
    // against Object.prototype and be treated as a real category.
    const categoryFromHash = () => {
      const raw = rawHash();
      if (!raw || PRODUCT_HASH.test(raw)) return null;

      // A retired slug keeps resolving, so links shared before a rename still work.
      const resolved = ownProperty(CATEGORY_ALIASES, raw) ? CATEGORY_ALIASES[raw] : raw;
      return ownProperty(CATEGORY_LABELS, resolved) ? resolved : null;
    };

    /**
     * Opens the product named by the fragment, if it is on screen.
     *
     * Looked up by scanning the rendered products rather than by keying into an
     * object, so a crafted id cannot reach a prototype property.
     * @returns {boolean} Whether a product was opened.
     */
    const openProductFromHash = () => openProduct(productIdFromHash());

    /**
     * Opens a product by id, if it is among those rendered.
     * @param {string|null} id The product id.
     * @returns {boolean} Whether a product was opened.
     */
    const openProduct = (id) => {
      if (!id) return false;

      const product = renderedProducts.find((entry) => entry.id === id);
      if (!product) return false;

      Modal.open(
        product,
        ownProperty(CATEGORY_LABELS, product.category)
          ? CATEGORY_LABELS[product.category]
          : categoryHeading.textContent
      );
      return true;
    };

    // renderProducts writes the fragment, so it has to be read back for the
    // browser's back and forward buttons to work. Re-rendering the category
    // already on screen is skipped, which also stops the write from looping.
    const bindHashNavigation = () => {
      window.addEventListener('hashchange', () => {
        // A product link on an already-rendered catalog only opens the modal.
        if (openProductFromHash()) return;

        // Coming back from a product link to a category: close the modal rather
        // than leaving it over the grid.
        if (Modal.currentlyOpen()) Modal.close();

        const category = categoryFromHash();
        if (!category || category === renderedCategory) return;
        renderProducts(category);
      });
    };

    // Bind click events for category buttons.
    const bindCategoryButtons = () => {
      categoryButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.stopPropagation();
          const submenu = button.nextElementSibling;
          const hasSubmenu = button.classList.contains('has-submenu') ||
                              (button.parentElement && button.parentElement.classList.contains('has-submenu'));
          if (hasSubmenu && submenu && submenu.classList.contains('submenu')) {
            const expanded = button.getAttribute('aria-expanded') === 'true';
            if (window.innerWidth <= 768) {
              button.setAttribute('aria-expanded', String(!expanded));
              submenu.classList.toggle('open', !expanded);
            } else {
              button.setAttribute('aria-expanded', String(!expanded));
              submenu.style.display = expanded ? 'none' : 'block';
            }
            return;
          }
          const category = button.getAttribute('data-category');
          await renderProducts(category);
          if (window.gtag) {
            gtag('event', 'select_category', {
              event_category: 'Navigation',
              event_label: category,
              value: 1,
            });
          }
          const nav = document.querySelector('nav');
          const menuToggle = document.getElementById('menu-toggle');
          if (nav.classList.contains('active')) {
            nav.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
          }
          collapseAllSubmenus();
        });
      });
    };

    const init = async () => {
      bindCategoryButtons();
      bindHashNavigation();

      // Opening a product writes #p/{id}, and closing it hands the fragment back
      // to the category. The modal owns neither, so the catalog supplies both.
      Modal.onNavigate({
        opened: (product) => {
          const fragment = `p/${product.id}`;
          if (window.location.hash.slice(1) !== fragment) window.location.hash = fragment;
        },
        closed: () => {
          if (productIdFromHash() && renderedCategory) {
            window.location.hash = renderedCategory;
          }
        },
      });

      // A shared link arrives as #p/{id}, which names a product rather than a
      // category. The whole catalog is rendered first so the product can be found
      // wherever it lives, then its modal opens.
      const deepLinked = productIdFromHash();
      await renderProducts(deepLinked ? ALL_CATEGORY : categoryFromHash() || ALL_CATEGORY);
      if (deepLinked) openProduct(deepLinked);
    };

    return { init };
  })();

  // --- Setup ---
  const setupCatalog = () => {
    Modal.init();
    Catalog.init();
  };

  // --- Mobile Menu Toggle ---
  document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.querySelector('nav');
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCatalog);
  } else {
    setupCatalog();
  }
})();
