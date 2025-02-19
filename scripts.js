// scripts.js

(function() {
  // In test mode, we want to always initialize (i.e. ignore the initialized guard).
  if (window.__catalogInitialized && !window.__isTest) return;
  window.__catalogInitialized = true;

  function setupCatalog() {
    // Cache DOM selectors
    const categoryButtons = document.querySelectorAll('nav button[data-category]');
    const productListContainer = document.getElementById('product-list');
    const categoryHeading = document.getElementById('category-heading');
    
    // Mobile menu elements
    const menuToggle = document.getElementById('menu-toggle');
    const nav = document.querySelector('nav');

    // Helper: Format numbers as Brazilian currency
    const formatCurrency = value =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    // Update category heading based on selection
    const updateCategoryHeading = (category) => {
      const headings = {
        all: 'Todos os Produtos',
        shoes: 'Calçados',
        slippers: 'Chinelos',
      };
      categoryHeading.textContent = headings[category] || 'Produtos';
    };

    // Function to fetch data for a given category
    const fetchCategoryData = async (category) => {
      try {
        if (category === 'all') {
          const categories = ['shoes', 'slippers'];
          const responses = await Promise.all(
            categories.map(cat => fetch(`products/${cat}.json`))
          );
          const jsonData = await Promise.all(
            responses.map(async (response) => {
              if (!response.ok) throw new Error(`Failed to fetch data for category ${category}`);
              return response.json();
            })
          );
          return jsonData.flat();
        } else {
          const response = await fetch(`products/${category}.json`);
          if (!response.ok) throw new Error(`Failed to fetch data for category ${category}`);
          return response.json();
        }
      } catch (error) {
        console.error(`Error fetching data for category ${category}:`, error);
        return [];
      }
    };

    // Render products for the selected category
    const renderProducts = async (category) => {
      productListContainer.innerHTML = ''; // Clear previous products
      updateCategoryHeading(category);
      const products = await fetchCategoryData(category);
      products.forEach(product => {
        const li = document.createElement('li');
        li.classList.add('product-item');

        const priceHTML = product.oldPrice
          ? `<span class="old-price">${formatCurrency(product.oldPrice)}</span>
             <span class="new-price">${formatCurrency(product.price)}</span>`
          : `<span class="price">${formatCurrency(product.price)}</span>`;

        li.innerHTML = `
          <img src="${product.image}" alt="${product.name}">
          <div class="product-details">
            <h3>${product.name}</h3>
            ${product.size && product.size !== 'N/A' ? `<span class="size">Tamanho: ${product.size}</span>` : ''}
            ${priceHTML}
          </div>
        `;
        productListContainer.appendChild(li);
      });
      // Update URL hash for bookmarking/sharing
      window.location.hash = category;
    };

    // Handle category button clicks
    const handleCategoryClick = async event => {
      const category = event.currentTarget.getAttribute('data-category');
      await renderProducts(category);
      // Example GA event tracking if available
      if (window.gtag) {
        gtag('event', 'select_category', {
          event_category: 'Navigation',
          event_label: category,
          value: 1,
        });
      }
      // Close mobile menu if open
      if (nav.classList.contains('active')) {
        nav.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    };

    categoryButtons.forEach(button => {
      button.addEventListener('click', handleCategoryClick);
    });

    // Mobile menu toggle event
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!expanded));
    });

    // Render the initial category (from URL hash or default to 'all')
    const initialCategory = window.location.hash.slice(1) || 'all';
    renderProducts(initialCategory);
  }

  // Run setupCatalog once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCatalog);
  } else {
    setupCatalog();
  }
})();
