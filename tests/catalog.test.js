/**
 * @jest-environment jest-environment-jsdom
 */
const { waitFor, fireEvent } = require('@testing-library/dom');
require('@testing-library/jest-dom');
const {
  setupDOM,
  setupMobile,
  setupGlobalFetchMock,
} = require('./catalogTestUtils');

// Force reinitialization in tests and mock GA
window.__isTest = true;
global.gtag = jest.fn();

const assertSnapshot = async (expectedHeading, expectedCount) => {
  await waitFor(() => {
    expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
  });
  await waitFor(() => {
    const items = document.querySelectorAll('#product-list .product-item');
    expect(items.length).toEqual(expectedCount);
  });
  expect(document.body.innerHTML).toMatchSnapshot();
};

const clickCategory = (category) => {
  const btn = document.querySelector(`nav button[data-category="${category}"]`);
  expect(btn).toBeInTheDocument();
  fireEvent.click(btn);
};

describe('Catalog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
    setupGlobalFetchMock();
    setupDOM();
  });

  const quantityOfProducts = 52;

  describe('Desktop View', () => {
    it('renders "All Products" correctly', async () => {
      await assertSnapshot("Todos os Produtos", quantityOfProducts);
    });

    it('renders final subcategory "Tênis" correctly on desktop', async () => {
      // Parent for final "Tênis" is now "shoes-man-subcategory"
      const selectFinalSubcategory = async (parentCat, finalCat, expectedHeading) => {
        const parentButton = document.querySelector(`nav button[data-category="${parentCat}"]`);
        expect(parentButton).toBeInTheDocument();
        fireEvent.click(parentButton);
        // Force the submenu visible.
        const submenu = parentButton.parentElement.querySelector('.submenu');
        submenu.style.display = 'block';
        const finalButton = submenu.querySelector(`button[data-category="${finalCat}"]`);
        expect(finalButton).toBeInTheDocument();
        fireEvent.click(finalButton);
        await waitFor(() => {
          expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
        });
      };
      // Use the new identifiers: parent "shoes-man-subcategory" and final "shoes-man"
      await selectFinalSubcategory("shoes-man-subcategory", "shoes-man", "Tênis");
    });

    it('renders final subcategory "Chinelos" correctly on desktop', async () => {
      const selectFinalSubcategory = async (parentCat, finalCat, expectedHeading) => {
        const parentButton = document.querySelector(`nav button[data-category="${parentCat}"]`);
        expect(parentButton).toBeInTheDocument();
        fireEvent.click(parentButton);
        const submenu = parentButton.parentElement.querySelector('.submenu');
        submenu.style.display = 'block';
        const finalButton = submenu.querySelector(`button[data-category="${finalCat}"]`);
        expect(finalButton).toBeInTheDocument();
        fireEvent.click(finalButton);
        await waitFor(() => {
          expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
        });
      };
      // Parent for "Chinelos" is still the same "shoes-man-subcategory"
      await selectFinalSubcategory("shoes-man-subcategory", "slippers-man", "Chinelos");
    });

    it('renders final subcategory "Camisetas" correctly on desktop', async () => {
      const selectFinalSubcategory = async (parentCat, finalCat, expectedHeading) => {
        const parentButton = document.querySelector(`nav button[data-category="${parentCat}"]`);
        expect(parentButton).toBeInTheDocument();
        fireEvent.click(parentButton);
        const submenu = parentButton.parentElement.querySelector('.submenu');
        submenu.style.display = 'block';
        const finalButton = submenu.querySelector(`button[data-category="${finalCat}"]`);
        expect(finalButton).toBeInTheDocument();
        fireEvent.click(finalButton);
        await waitFor(() => {
          expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
        });
      };

      await selectFinalSubcategory("clothing-man-subcategory", "tshirts-man", "Camisetas");
    });

    it('renders final subcategory "Camisetas Fitness" correctly on desktop', async () => {
      const selectFinalSubcategory = async (parentCat, finalCat, expectedHeading) => {
        const parentButton = document.querySelector(`nav button[data-category="${parentCat}"]`);
        expect(parentButton).toBeInTheDocument();
        fireEvent.click(parentButton);
        const submenu = parentButton.parentElement.querySelector('.submenu');
        submenu.style.display = 'block';
        const finalButton = submenu.querySelector(`button[data-category="${finalCat}"]`);
        expect(finalButton).toBeInTheDocument();
        fireEvent.click(finalButton);
        await waitFor(() => {
          expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
        });
      };

      await selectFinalSubcategory("clothing-man-subcategory", "tshirts-fitness-man", "Camisetas Fitness");
    });
  });

  describe('Mobile View', () => {
    beforeEach(async () => {
      // Simulate a mobile viewport.
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
      await setupMobile();
    });

    it('renders "All Products" correctly on mobile', async () => {
      await assertSnapshot("Todos os Produtos", quantityOfProducts);
    });

    it('renders final subcategory "Tênis" correctly on mobile', async () => {
      // Open mobile menu.
      const menuToggle = document.getElementById('menu-toggle');
      expect(menuToggle).toBeInTheDocument();
      fireEvent.click(menuToggle);
      // Select the parent "Calçados" button on mobile.
      const parentButton = document.querySelector('li.menu-item.has-submenu > button[data-category="shoes-man-subcategory"]');
      expect(parentButton).toBeInTheDocument();
      fireEvent.click(parentButton);
      // Now select the final "Tênis" button.
      const finalButton = document.querySelector('li.menu-item.has-submenu > ul.submenu.open button[data-category="shoes-man"]');
      // If your mobile implementation adds the "open" class to the submenu.
      expect(finalButton).toBeInTheDocument();
      fireEvent.click(finalButton);
      await waitFor(() => {
        expect(document.getElementById('category-heading')).toHaveTextContent("Tênis");
      });
      await assertSnapshot("Tênis", 27);
    });

    it('renders final subcategory "Chinelos" correctly on mobile', async () => {
      const menuToggle = document.getElementById('menu-toggle');
      fireEvent.click(menuToggle);
      const parentButton = document.querySelector('li.menu-item.has-submenu > button[data-category="shoes-man-subcategory"]');
      expect(parentButton).toBeInTheDocument();
      fireEvent.click(parentButton);
      const finalButton = document.querySelector('li.menu-item.has-submenu > ul.submenu.open button[data-category="slippers-man"]');
      expect(finalButton).toBeInTheDocument();
      fireEvent.click(finalButton);
      await waitFor(() => {
        expect(document.getElementById('category-heading')).toHaveTextContent("Chinelos");
      });
      await assertSnapshot("Chinelos", 8);
    });

    it('renders final subcategory "Camisetas" correctly on mobile', async () => {
      const menuToggle = document.getElementById('menu-toggle');
      fireEvent.click(menuToggle);
      const parentButton = document.querySelector('li.menu-item.has-submenu > button[data-category="clothing-man-subcategory"]');
      expect(parentButton).toBeInTheDocument();
      fireEvent.click(parentButton);
      const finalButton = document.querySelector('li.menu-item.has-submenu > ul.submenu.open button[data-category="tshirts-man"]');
      expect(finalButton).toBeInTheDocument();
      fireEvent.click(finalButton);
      await waitFor(() => {
        expect(document.getElementById('category-heading')).toHaveTextContent("Camisetas");
      });
      await assertSnapshot("Camisetas", 13);
    });

    it('renders final subcategory "Camisetas Fitness" correctly on mobile', async () => {
      const menuToggle = document.getElementById('menu-toggle');
      fireEvent.click(menuToggle);
      const parentButton = document.querySelector('li.menu-item.has-submenu > button[data-category="clothing-man-subcategory"]');
      expect(parentButton).toBeInTheDocument();
      fireEvent.click(parentButton);
      const finalButton = document.querySelector('li.menu-item.has-submenu > ul.submenu.open button[data-category="tshirts-fitness-man"]');
      expect(finalButton).toBeInTheDocument();
      fireEvent.click(finalButton);
      await waitFor(() => {
        expect(document.getElementById('category-heading')).toHaveTextContent("Camisetas Fitness");
      });
      await assertSnapshot("Camisetas Fitness", 4);
    });
  });

  describe('Modal Functionality', () => {
    beforeEach(async () => {
      // Use desktop final subcategory selection to load products.
      const selectFinalSubcategory = async (parentCat, finalCat, expectedHeading) => {
        const parentButton = document.querySelector(`nav button[data-category="${parentCat}"]`);
        expect(parentButton).toBeInTheDocument();
        fireEvent.click(parentButton);
        const submenu = parentButton.parentElement.querySelector('.submenu');
        submenu.style.display = 'block';
        const finalButton = submenu.querySelector(`button[data-category="${finalCat}"]`);
        expect(finalButton).toBeInTheDocument();
        fireEvent.click(finalButton);
        await waitFor(() => {
          expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
        });
      };
      await selectFinalSubcategory("shoes-man-subcategory", "shoes-man", "Tênis");
      await waitFor(() => {
        expect(document.querySelectorAll('#product-list .product-item').length).toBeGreaterThan(0);
      });
    });

    it('opens modal on product click and logs GA event', async () => {
      const product = document.querySelector('#product-list .product-item');
      fireEvent.click(product);
      await waitFor(() => {
        const modal = document.getElementById('product-modal');
        expect(modal).toHaveStyle({ display: 'flex' });
      });
      expect(global.gtag).toHaveBeenCalledWith('event', 'open_modal', expect.any(Object));
    });

    it('redirects to WhatsApp with correct message when clicking "Comprar este produto"', async () => {
      // Open modal by clicking on a product.
      const product = document.querySelector('#product-list .product-item');
      fireEvent.click(product);
      await waitFor(() => {
        expect(document.getElementById('product-modal')).toHaveStyle({ display: 'flex' });
      });
      // Spy on window.open.
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});
      // Click the buy button.
      const buyButton = document.getElementById('buy-product');
      expect(buyButton).toBeInTheDocument();
      fireEvent.click(buyButton);
      // Get expected values from the DOM.
      const categoryText = document.getElementById('category-heading').textContent;
      const productName = product.querySelector('h3').textContent;
      const expectedMessage = `Olá, acabei de conferir seu catálogo online e na categoria ${categoryText}, me interessei pelo produto ${productName}. Poderia, por favor, me enviar mais informações e confirmar a disponibilidade? Obrigado!`;
      const expectedUrl = `https://wa.me/5519999762594?text=${encodeURIComponent(expectedMessage)}`;
      expect(openSpy).toHaveBeenCalledWith(expectedUrl, '_blank');
      openSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      const btn = document.querySelector('nav button[data-category="all"]');
      btn.setAttribute('data-category', 'nonexistent');
      global.fetch.mockImplementationOnce(() =>
        Promise.resolve({ ok: false, statusText: 'Not Found' })
      );
      fireEvent.click(btn);
      await waitFor(() => {
        const list = document.getElementById('product-list');
        expect(list.children.length).toEqual(0);
      });
    });
  });
});
