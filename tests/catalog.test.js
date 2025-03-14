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

const assertSnapshot = async () => {
  expect(document.body.innerHTML).toMatchSnapshot();
};

const assertExpectedHeading = async (expectedHeading) => {
  await waitFor(() => {
    expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
  });
};

const assertExpectedProductQuantity = async (expectedCount) => {
  await waitFor(() => {    
    expect(document.querySelectorAll('#product-list .product-item').length).toEqual(expectedCount);
  });
};

const asserts = async (expectedHeading, expectedCount) => {
  await assertExpectedHeading(expectedHeading);
  await assertExpectedProductQuantity(expectedCount);
  await assertSnapshot();
};

const assertAllProducts = async () => {
  const expectedHeading = "Todos os Produtos";
  const expectedCount = 65;
  await asserts(expectedHeading, expectedCount);
};

const selectMenuOption = async (dataCategory) => {
  const menuOption = document.querySelector(`button[data-category="${dataCategory}"]`);
  expect(menuOption).toBeInTheDocument();
  fireEvent.click(menuOption);
};

const clickMenuOptions = async (categories) => {
  for (const category of categories) {
    await selectMenuOption(category);
  }
};

const selectManSubcategory = async () => {
  await clickMenuOptions(['fashion-category', 'man-subcategory']);
};

const selectClothingManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('clothing-man-subcategory');
};

const selectShoesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('shoes-man-subcategory');
};

const selectShoesMan = async () => {
  const expectedHeading = "Tênis";
  const expectedCount = 27;
  await selectShoesManSubcategory();
  await selectMenuOption('shoes-man');
  await asserts(expectedHeading, expectedCount);
};

const selectSlippersMan = async () => {
  const expectedHeading = "Chinelos";
  const expectedCount = 1;
  await selectShoesManSubcategory();
  await selectMenuOption('slippers-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTshirtsCasualMan = async () => {
  const expectedHeading = "Camisetas Casuais Masculina";
  const expectedCount = 33;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-casual-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTshirtsFitnessMan = async () => {
  const expectedHeading = "Camisetas Fitness Masculina";
  const expectedCount = 4;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-fitness-man');
  await asserts(expectedHeading, expectedCount);
};

describe('Catalog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
    setupGlobalFetchMock();
    setupDOM();
  });

  describe('Desktop View', () => {
    it('renders "All Products" correctly', async () => {
      await assertAllProducts();
    });

    it('renders final subcategory "Tênis" correctly on desktop', async () => {
      await selectShoesMan();
    });

    it('renders final subcategory "Chinelos" correctly on desktop', async () => {
      await selectSlippersMan();
    });

    it('renders final subcategory "Camisetas Casuais Masculina" correctly on desktop', async () => {
      await selectTshirtsCasualMan();
    });

    it('renders final subcategory "Camisetas Fitness Masculina" correctly on desktop', async () => {
      await selectTshirtsFitnessMan();
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
      await assertAllProducts();
    });

    it('renders final subcategory "Tênis" correctly on mobile', async () => {
      await selectShoesMan();
    });

    it('renders final subcategory "Chinelos" correctly on mobile', async () => {
      await selectSlippersMan();
    });

    it('renders final subcategory "Camisetas Casuais Masculina" correctly on mobile', async () => {
      await selectTshirtsCasualMan();
    });

    it('renders final subcategory "Camisetas Fitness Masculina" correctly on mobile', async () => {
      await selectTshirtsFitnessMan();
    });
  });

  describe('Sorting Order', () => {
    // For these tests, we want to override the fetch mock with controlled test data.
    const customData = {
      "shoes-man": [{ name: "[0103250820] Emporio Armani", price: 100 }],
      "tshirts-casual-man": [{ name: "[0803251811] Versace", price: 200 }],
      "tshirts-fitness-man": [{ name: "[2802251122] Tommy Hilfiger", price: 300 }],
      "slippers-man": []
    };

    beforeEach(() => {
      // Reset modules and override fetch BEFORE initializing the catalog.
      jest.resetModules();
      global.fetch.mockImplementation((url) => {
        const match = url.match(/products\/(.*)\.json/);
        const category = match ? match[1] : null;
        if (category && customData.hasOwnProperty(category)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(customData[category])
          });
        }
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });
      setupDOM();
    });

    it('sorts products in descending order based on date parsed from product names', async () => {
      await waitFor(() => {
        expect(document.getElementById('category-heading')).toHaveTextContent("Todos os Produtos");
      });
      // Wait for product items to be rendered.
      await waitFor(() => {
        expect(document.querySelectorAll('#product-list .product-item').length).toBeGreaterThan(0);
      });
      // Collect product names.
      const productItems = Array.from(document.querySelectorAll('#product-list .product-item'));
      const productNames = productItems.map(item => item.querySelector('h3').textContent);
      // Expected descending order:
      // "[0803251811] Versace" (Mar 8, 2025 18:11)
      // "[0103250820] Emporio Armani" (Mar 1, 2025 08:20)
      // "[2802251122] Tommy Hilfiger" (Feb 28, 2025 11:22)
      expect(productNames).toEqual([
        "[0803251811] Versace",
        "[0103250820] Emporio Armani",
        "[2802251122] Tommy Hilfiger"
      ]);
    });
  });

  describe('Modal Functionality', () => {
    beforeEach(async () => {
      await selectShoesMan();
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

    it('redirects to WhatsApp with correct message when clicking "Comprar" button', async () => {
      const product = document.querySelector('#product-list .product-item');
      fireEvent.click(product);

      await waitFor(() => {
        expect(document.getElementById('product-modal')).toHaveStyle({ display: 'flex' });
      });

      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});
      const buyButton = document.getElementById('buy-product');
      expect(buyButton).toBeInTheDocument();
      fireEvent.click(buyButton);

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
