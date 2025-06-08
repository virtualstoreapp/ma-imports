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

//
// Snapshot and heading assertions
//
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
  const expectedHeading = "Novidades";
  const expectedCount = 149;
  await asserts(expectedHeading, expectedCount);
};

//
// Menu and category selection helpers
//
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

const selectAccessoriesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('accessories-man-subcategory');
};

//
// Category selection functions with expected results
//
const selectShoesMan = async () => {
  const expectedHeading = "Tênis";
  const expectedCount = 28;
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
  const expectedCount = 36;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-casual-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTshirtsDryFitMan = async () => {
  const expectedHeading = "Camisetas Dry Fit Masculina";
  const expectedCount = 20;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-dryfit-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTshirtsPoloMan = async () => {
  const expectedHeading = "Camisetas Polo Masculina";
  const expectedCount = 4;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-polo-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTankTopCasualMan = async () => {
  const expectedHeading = "Regatas Casuais Masculina";
  const expectedCount = 3;
  await selectClothingManSubcategory();
  await selectMenuOption('tank-top-casual-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTankTopDryFitCasualMan = async () => {
  const expectedHeading = "Regatas Dry Fit Masculina";
  const expectedCount = 8;
  await selectClothingManSubcategory();
  await selectMenuOption('tank-top-dryfit-man');
  await asserts(expectedHeading, expectedCount);
};

const selectShortsSweatshortsMan = async () => {
  const expectedHeading = "Bermudas Moletom Masculina";
  const expectedCount = 8;
  await selectClothingManSubcategory();
  await selectMenuOption('shorts-sweatshorts-man');
  await asserts(expectedHeading, expectedCount);
};

const selectShortsBasicMan = async () => {
  const expectedHeading = "Bermudas Básica Masculina";
  const expectedCount = 1;
  await selectClothingManSubcategory();
  await selectMenuOption('shorts-basic-man');
  await asserts(expectedHeading, expectedCount);
};

const selectShortsJeansMan = async () => {
  const expectedHeading = "Bermudas Jeans Masculina";
  const expectedCount = 8;
  await selectClothingManSubcategory();
  await selectMenuOption('shorts-jeans-man');
  await asserts(expectedHeading, expectedCount);
};

const selectShortsTactelMan = async () => {
  const expectedHeading = "Bermudas Tactel Masculina";
  const expectedCount = 14;
  await selectClothingManSubcategory();
  await selectMenuOption('shorts-tactel-man');
  await asserts(expectedHeading, expectedCount);
};

const selectCapsMan = async () => {
  const expectedHeading = "Bonés Masculino";
  const expectedCount = 5;
  await selectAccessoriesManSubcategory();
  await selectMenuOption('caps-man');
  await asserts(expectedHeading, expectedCount);
};

const selectSweatshirtMan = async () => {
  const expectedHeading = "Blusas Masculina";
  const expectedCount = 6;
  await selectClothingManSubcategory();
  await selectMenuOption('sweatshirts-man');
  await asserts(expectedHeading, expectedCount);
};

const selectSocksMan = async () => {
  const expectedHeading = "Meias Masculina";
  const expectedCount = 7;
  await selectShoesManSubcategory();
  await selectMenuOption('socks-man');
  await asserts(expectedHeading, expectedCount);
};

//
// Test suites
//
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

    it('renders final subcategory "Camisetas Dry Fit Masculina" correctly on desktop', async () => {
      await selectTshirtsDryFitMan();
    });

    it('renders final subcategory "Camisetas Polo Masculina" correctly on desktop', async () => {
      await selectTshirtsPoloMan();
    });

    it('renders final subcategory "Regatas Casuais Masculina" correctly on desktop', async () => {
      await selectTankTopCasualMan();
    });

    it('renders final subcategory "Regatas Dry Fit Masculina" correctly on desktop', async () => {
      await selectTankTopDryFitCasualMan();
    });

    it('renders final subcategory "Bermudas Moletom Masculina" correctly on desktop', async () => {
      await selectShortsSweatshortsMan();
    });

    it('renders final subcategory "Bermudas Básica Masculina" correctly on desktop', async () => {
      await selectShortsBasicMan();
    });

    it('renders final subcategory "Bermudas Jeans Masculina" correctly on desktop', async () => {
      await selectShortsJeansMan();
    });

    it('renders final subcategory "Bermudas Tactel Masculina" correctly on desktop', async () => {
      await selectShortsTactelMan();
    });

    it('renders final subcategory "Bonés Masculino" correctly on desktop', async () => {
      await selectCapsMan();
    });

    it('renders final subcategory "Blusas Masculina" correctly on desktop', async () => {
      await selectSweatshirtMan();
    });

    it('renders final subcategory "Meias Masculina" correctly on desktop', async () => {
      await selectSocksMan();
    });
  });

  describe('Mobile View', () => {
    beforeEach(async () => {
      // Simulate mobile viewport.
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

    it('renders final subcategory "Camisetas Dry Fit Masculina" correctly on mobile', async () => {
      await selectTshirtsDryFitMan();
    });

    it('renders final subcategory "Camisetas Polo Masculina" correctly on mobile', async () => {
      await selectTshirtsPoloMan();
    });

    it('renders final subcategory "Regatas Casuais Masculina" correctly on desktop', async () => {
      await selectTankTopCasualMan();
    });

    it('renders final subcategory "Regatas Dry Fit Masculina" correctly on desktop', async () => {
      await selectTankTopDryFitCasualMan();
    });

    it('renders final subcategory "Bermudas Moletom Masculina" correctly on mobile', async () => {
      await selectShortsSweatshortsMan();
    });

    it('renders final subcategory "Bermudas Básica Masculina" correctly on mobile', async () => {
      await selectShortsBasicMan();
    });

    it('renders final subcategory "Bermudas Jeans Masculina" correctly on mobile', async () => {
      await selectShortsJeansMan();
    });

    it('renders final subcategory "Bermudas Tactel Masculina" correctly on desktop', async () => {
      await selectShortsTactelMan();
    });

    it('renders final subcategory "Bonés Masculino" correctly on desktop', async () => {
      await selectCapsMan();
    });

    it('renders final subcategory "Blusas Masculina" correctly on desktop', async () => {
      await selectSweatshirtMan();
    });

    it('renders final subcategory "Meias Masculina" correctly on desktop', async () => {
      await selectSocksMan();
    });
  });

  describe('Sorting Order', () => {
    // Override fetch mock with controlled test data.
    const customData = {
      "shoes-man": [{ name: "[1202252201] Shoe Man", price: 149 }],
      "slippers-man": [{ name: "[1702251140] Slipper Man", price: 29.90 }],
      "tshirts-casual-man": [{ name: "[0103250820] Tshirt Casual Man", price: 89.90 }],
      "tshirts-dryfit-man": [{ name: "[2703251659] Tshirt Dryfit Man", price: 59.90 }],
      "tshirts-polo-man": [{ name: "[1603250851] Tshirt Polo Man", price: 59.90 }],
      "tank-top-casual-man": [{ name: "[1903251705] Tank Top Casual Man", price: 39.90 }],
      "tank-top-dryfit-man": [{ name: "[0703251715] Tank Top Dryfit Man", price: 59.90 }],
      "shorts-sweatshorts-man": [{ name: "[2003250848] Short Basic Man", price: 69.90 }],
      "shorts-basic-man": [{ name: "[2103251150] Short Basic Man", price: 28.00 }],
      "shorts-jeans-man": [{ name: "[2603251652] Short Jeans Man", price: 79.90 }],
      "shorts-tactel-man": [{ name: "[0304251805] Short Tactel Man", price: 59.90 }],
      "caps-man": [{ name: "[0106250956] Cap Man", price: 59.90 }],
      "socks-man": [{ name: "[0106250834] Socks Man", price: 21.90 }],
      "sweatshirts-man": [{ name: "[0106250800] Sweatshirt Man", price: 299.00 }],
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
        expect(document.getElementById('category-heading')).toHaveTextContent("Novidades");
      });
      await waitFor(() => {
        expect(document.querySelectorAll('#product-list .product-item').length).toBeGreaterThan(0);
      });
      const productItems = Array.from(document.querySelectorAll('#product-list .product-item'));
      const productNames = productItems.map(item => item.querySelector('h3').textContent);
      expect(productNames).toEqual([
        "[0106250956] Cap Man",
        "[0106250834] Socks Man",
        "[0106250800] Sweatshirt Man",
        "[0304251805] Short Tactel Man",
        "[2703251659] Tshirt Dryfit Man",
        "[2603251652] Short Jeans Man",
        "[2103251150] Short Basic Man",
        "[2003250848] Short Basic Man",
        "[1903251705] Tank Top Casual Man",
        "[1603250851] Tshirt Polo Man",
        "[0703251715] Tank Top Dryfit Man",
        "[0103250820] Tshirt Casual Man",
        "[1702251140] Slipper Man",
        "[1202252201] Shoe Man"
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

  describe('Sold Out Label', () => {
    beforeEach(() => {
      // Override fetch with custom data for sold-out product.
      const customSoldOutData = {
        "slippers-man": [
          { name: "[1702251140] Tommy Hilfiger", price: 29.90, soldOut: true }
        ]
      };
      global.fetch.mockImplementation((url) => {
        const match = url.match(/products\/(.*)\.json/);
        const category = match ? match[1] : null;
        if (category && customSoldOutData.hasOwnProperty(category)) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(customSoldOutData[category])
          });
        }
        return Promise.reject(new Error(`Unknown URL: ${url}`));
      });
      setupDOM();
    });

    it('displays sold out label in product list item', async () => {
      const button = document.querySelector('nav button[data-category="slippers-man"]');
      fireEvent.click(button);
      await waitFor(() => {
        const productList = document.getElementById('product-list');
        expect(productList.children.length).toBeGreaterThan(0);
      });
      const productItem = document.querySelector('#product-list .product-item');
      const soldOutLabel = productItem.querySelector('.sold-out-label');
      expect(soldOutLabel).toBeInTheDocument();
      expect(soldOutLabel).toHaveTextContent("Esgotado");
    });

    it('displays sold out label in modal and disables "Comprar" button for sold out product', async () => {
      const button = document.querySelector('nav button[data-category="slippers-man"]');
      fireEvent.click(button);
      await waitFor(() => {
        const productList = document.getElementById('product-list');
        expect(productList.children.length).toBeGreaterThan(0);
      });
      const productItem = document.querySelector('#product-list .product-item');
      fireEvent.click(productItem);
      await waitFor(() => {
        const modal = document.getElementById('product-modal');
        expect(modal).toHaveStyle({ display: 'flex' });
      });
      const modalSoldOutLabel = document.querySelector('#modal-image-container .sold-out-label');
      expect(modalSoldOutLabel).toBeInTheDocument();
      expect(modalSoldOutLabel).toHaveTextContent("Esgotado");
      const buyButton = document.getElementById('buy-product');
      expect(buyButton).toBeDisabled();
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
