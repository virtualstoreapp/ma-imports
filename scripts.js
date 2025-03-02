(function() {
  // Prevent reinitialization (except in test mode)
  if (window.__catalogInitialized && !window.__isTest) return;
  window.__catalogInitialized = true;

  /* -------------------------
     Helpers
  ------------------------- */
  const formatCurrency = (value) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const updateCategoryHeading = (category, headingEl) => {
    const headings = {
      all: 'Todos os Produtos',
      'shoes-man': 'Tênis',
      'slippers-man': 'Chinelos',
      'tshirts-man': 'Camisetas',
      'sneakers-man': 'Sneakers',
    };
    headingEl.textContent = headings[category] || 'Produtos';
  };

  const collapseAllSubmenus = () => {
    const submenuButtons = document.querySelectorAll('nav button.has-submenu, nav li.has-submenu > button');
    submenuButtons.forEach((button) => {
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

  /* -------------------------
     Modal Module
  ------------------------- */
  const Modal = (() => {
    let modal, currentImages = [], currentIndex = 0, currentZoom = 1, currentProductName = '';

    const init = () => {
      modal = document.createElement('div');
      modal.id = 'product-modal';
      modal.innerHTML = `
        <div id="modal-content">
          <button id="modal-close">X</button>
          <div id="modal-image-container">
            <img id="modal-image" src="" alt="">
          </div>
          <div id="modal-controls">
            <button id="prev-image">&lt;</button>
            <button id="zoom-out">-</button>
            <button id="zoom-in">+</button>
            <button id="next-image">&gt;</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      bindEvents();
    };

    const bindEvents = () => {
      document.getElementById('modal-close').addEventListener('click', close);
      document.getElementById('prev-image').addEventListener('click', showPrev);
      document.getElementById('next-image').addEventListener('click', showNext);
      document.getElementById('zoom-in').addEventListener('click', () => adjustZoom(0.2));
      document.getElementById('zoom-out').addEventListener('click', () => adjustZoom(-0.2));
      modal.addEventListener('click', (event) => {
        if (event.target === modal) close();
      });
    };

    const updateImage = () => {
      const modalImage = document.getElementById('modal-image');
      modalImage.src = currentImages[currentIndex];
      modalImage.style.transform = `scale(${currentZoom})`;
    };

    const updateNavButtons = () => {
      const prevBtn = document.getElementById('prev-image');
      const nextBtn = document.getElementById('next-image');
      const disableNav = currentImages.length < 2;
      prevBtn.disabled = disableNav;
      nextBtn.disabled = disableNav;
    };

    const open = (product) => {
      currentImages = Array.isArray(product.images) ? product.images : [product.image];
      currentIndex = 0;
      currentZoom = 1;
      currentProductName = product.name;
      updateImage();
      updateNavButtons();
      modal.style.display = 'flex';
      if (window.gtag) {
        gtag('event', 'open_modal', {
          event_category: 'Product',
          event_label: currentProductName,
        });
      }
    };

    const close = () => {
      modal.style.display = 'none';
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

    return { init, open, close };
  })();

  /* -------------------------
     Catalog Module
  ------------------------- */
  const Catalog = (() => {
    // Select all menu buttons (including submenu buttons)
    const categoryButtons = document.querySelectorAll('nav button[data-category]');
    const productListContainer = document.getElementById('product-list');
    const categoryHeading = document.getElementById('category-heading');

    const fetchCategoryData = async (category) => {
      try {
        if (category === 'all') {
          const categories = ['shoes-man', 'tshirts-man', 'slippers-man'];
          const responses = await Promise.all(
            categories.map((cat) => fetch(`products/${cat}.json`))
          );
          const jsonData = await Promise.all(
            responses.map(async (response, idx) => {
              if (!response.ok)
                throw new Error(`Failed to fetch data for category ${categories[idx]}`);
              return response.json();
            })
          );
          return jsonData.flat();
        } else {
          const response = await fetch(`products/${category}.json`);
          if (!response.ok)
            throw new Error(`Failed to fetch data for category ${category}`);
          return response.json();
        }
      } catch (error) {
        console.error(`Error fetching data for category ${category}:`, error);
        return [];
      }
    };

    const renderProducts = async (category) => {
      productListContainer.innerHTML = '';
      updateCategoryHeading(category, categoryHeading);
      const products = await fetchCategoryData(category);
      products.forEach((product) => {
        const li = document.createElement('li');
        li.classList.add('product-item');
        const priceHTML =
          product.oldPrice && product.oldPrice > 0
            ? `<span class="old-price">${formatCurrency(product.oldPrice)}</span>
               <span class="new-price">${formatCurrency(product.price)}</span>`
            : `<span class="price">${formatCurrency(product.price)}</span>`;
        const imgSrc = Array.isArray(product.images) ? product.images[0] : product.image;
        li.innerHTML = `
          <img src="${imgSrc}" alt="${product.name}">
          <div class="product-details">
            <h3>${product.name}</h3>
            ${product.description ? `<p class="description">${product.description}</p>` : ''}
            ${product.size && product.size !== 'N/A' ? `<span class="size">Tamanho: ${product.size}</span>` : ''}
            ${priceHTML}
          </div>
        `;
        li.addEventListener('click', () => {
          if (window.gtag) {
            gtag('event', 'product_click', {
              event_category: 'Product',
              event_label: product.name,
            });
          }
          Modal.open(product);
        });
        productListContainer.appendChild(li);
      });
      window.location.hash = category;
    };

    const bindCategoryButtons = () => {
      categoryButtons.forEach((button) => {
        button.addEventListener('click', async (event) => {
          event.stopPropagation();
          const hasSubmenu =
            button.classList.contains('has-submenu') ||
            (button.parentElement && button.parentElement.classList.contains('has-submenu'));
          const submenu = button.nextElementSibling;
          if (hasSubmenu && submenu && submenu.classList.contains('submenu')) {
            const expanded = button.getAttribute('aria-expanded') === 'true';
            if (window.innerWidth <= 768) {
              button.setAttribute('aria-expanded', String(!expanded));
              submenu.classList.toggle('open', !expanded);
            } else {
              const newExpanded = !expanded;
              button.setAttribute('aria-expanded', String(newExpanded));
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
      const initialCategory = window.location.hash.slice(1) || 'all';
      await renderProducts(initialCategory);
    };

    return { init };
  })();

  const setupCatalog = () => {
    Modal.init();
    Catalog.init();
  };

  /* -------------------------
     Mobile Menu Toggle
  ------------------------- */
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
