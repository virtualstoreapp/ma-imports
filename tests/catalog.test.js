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
  const expectedCount = 97;
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
  const expectedCount = 35;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-casual-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTshirtsDryFitMan = async () => {
  const expectedHeading = "Camisetas Dry Fit Masculina";
  const expectedCount = 6;
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

const selectTshirtsFitnessMan = async () => {
  const expectedHeading = "Camisetas Fitness Masculina";
  const expectedCount = 4;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-fitness-man');
  await asserts(expectedHeading, expectedCount);
};

const selectTshirtsTankTopMan = async () => {
  const expectedHeading = "Camisetas Regata Masculina";
  const expectedCount = 3;
  await selectClothingManSubcategory();
  await selectMenuOption('tshirts-tank-top-man');
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

    it('renders final subcategory "Camisetas Fitness Masculina" correctly on desktop', async () => {
      await selectTshirtsFitnessMan();
    });

    it('renders final subcategory "Camisetas Regata Masculina" correctly on desktop', async () => {
      await selectTshirtsTankTopMan();
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

    it('renders final subcategory "Camisetas Dry Fit Masculina" correctly on desktop', async () => {
      await selectTshirtsDryFitMan();
    });

    it('renders final subcategory "Camisetas Polo Masculina" correctly on mobile', async () => {
      await selectTshirtsPoloMan();
    });

    it('renders final subcategory "Camisetas Fitness Masculina" correctly on mobile', async () => {
      await selectTshirtsFitnessMan();
    });

    it('renders final subcategory "Camisetas Regata Masculina" correctly on desktop', async () => {
      await selectTshirtsTankTopMan();
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
  });

  describe('Sorting Order', () => {
    // For these tests, we want to override the fetch mock with controlled test data.
    const customData = {
      "shoes-man": [{ name: "[1202252201] Adidas Campus", price: 149 }],
      "slippers-man": [{ name: "[1702251140] Tommy Hilfiger", price: 29.90 }],
      "tshirts-casual-man": [{ name: "[0103250820] Emporio Armani", price: 89.90 }],
      "tshirts-dryfit-man": [{ name: "[2703251659] Mizuno", price: 59.90 }],
      "tshirts-fitness-man": [{ name: "[0703251712] Regata Puma", price: 59.90 }],
      "tshirts-polo-man": [{ name: "[1603250851] Calvin Klein", price: 59.90 }],
      "tshirts-tank-top-man": [{ name: "[1903251705] Hugo Boss", price: 39.90 }],
      "shorts-sweatshorts-man": [{ name: "[2003250848] Oakley", price: 69.90 }],
      "shorts-basic-man": [{ name: "[2103251150] Nike", price: 28.00 }],
      "shorts-jeans-man": [{ name: "[2603251652] Lacoste", price: 79.90 }],
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
      expect(productNames).toEqual([
        "[2703251659] Mizuno",
        "[2603251652] Lacoste",
        "[2103251150] Nike",
        "[2003250848] Oakley",
        "[1903251705] Hugo Boss",
        "[1603250851] Calvin Klein",
        "[0703251712] Regata Puma",
        "[0103250820] Emporio Armani",
        "[1702251140] Tommy Hilfiger",
        "[1202252201] Adidas Campus"
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
      // Override fetch with custom data that marks a product as sold out.
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
