const { fireEvent } = require('@testing-library/dom');
const {
  asserts,
} = require('./catalogAsserts');

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

const selectWomanSubcategory = async () => {
  await clickMenuOptions(['fashion-category', 'woman-subcategory']);
};

const selectChildrenSubcategory = async () => {
  await clickMenuOptions(['fashion-category', 'children-subcategory']);
}

const selectClothingManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('clothing-man-subcategory');
};

const selectClothingWomanSubcategory = async () => {
  await selectWomanSubcategory();
  await selectMenuOption('clothing-woman-subcategory');
};

const selectClothingChildrenSubcategory = async () => {
  await selectChildrenSubcategory();
  await selectMenuOption('sets-children-subcategory');
}

const selectProduct = async (
  heading, productCount, subcategoryFunction, dataCategory
) => {
  const expectedHeading = heading;
  const expectedCount = productCount;

  await subcategoryFunction();
  await selectMenuOption(dataCategory);

  await asserts(expectedHeading, expectedCount);
};

const selectSweatshirtsMan = async () => {
  await selectProduct("Blusas Masculina", 13, selectClothingManSubcategory, 'sweatshirts-man');
};

const selectTshirtsCasualMan = async () => {
  await selectProduct("Camisetas Casuais Masculina", 41, selectClothingManSubcategory, 'tshirts-casual-man');
};

const selectTshirtsDryFitMan = async () => {
  await selectProduct("Camisetas Dry Fit Masculina", 21, selectClothingManSubcategory, 'tshirts-dryfit-man');
};

const selectTshirtsPoloMan = async () => {
  await selectProduct("Camisetas Polo Masculina", 4, selectClothingManSubcategory, 'tshirts-polo-man');
};

const selectDressShirtsMan = async () => {
  await selectProduct("Camisetas Sociais Masculina", 5, selectClothingManSubcategory, 'dress-shirts-man');
};

const selectUnderwearMan = async () => {
  await selectProduct("Cuecas Masculina", 15, selectClothingManSubcategory, 'underwear-man-subcategory')
}

const selectTankTopCasualMan = async () => {
  await selectProduct("Regatas Casuais Masculina", 3, selectClothingManSubcategory, 'tank-top-casual-man');
};

const selectTankTopDryFitCasualMan = async () => {
  await selectProduct("Regatas Dry Fit Masculina", 8, selectClothingManSubcategory, 'tank-top-dryfit-man');
};

const selectShortsBasicMan = async () => {
  await selectProduct("Bermudas Básica Masculina", 1, selectClothingManSubcategory, 'shorts-basic-man');
};

const selectShortsJeansMan = async () => {
  await selectProduct("Bermudas Jeans Masculina", 8, selectClothingManSubcategory, 'shorts-jeans-man');
};

const selectShortsJeansWoman = async () => {
  await selectProduct("Bermudas Jeans Feminina", 1, selectClothingWomanSubcategory, 'shorts-jeans-woman');
};

const selectShortsSweatshortsMan = async () => {
  await selectProduct("Bermudas Moletom Masculina", 9, selectClothingManSubcategory, 'shorts-sweatshorts-man');
};

const selectShortsTactelMan = async () => {
  await selectProduct("Bermudas Tactel Masculina", 14, selectClothingManSubcategory, 'shorts-tactel-man');
};

const selectPantsSweatpantsMan = async () => {
  await selectProduct("Calças Moletom Masculina", 3, selectClothingManSubcategory, 'pants-sweatpants-man');
}

const selectPantsJeansMan = async () => {
    await selectProduct("Calças Jeans Masculina", 2, selectClothingManSubcategory, 'pants-jeans-man');
}

const selectPantsJeansWoman = async () => {
    await selectProduct("Calças Jeans Feminina", 3, selectClothingWomanSubcategory, 'pants-jeans-woman');
}

const selectFitnessLeggingWoman = async () => {
    await selectProduct("Calças Legging Feminina", 5, selectClothingWomanSubcategory, 'fitness-legging-woman');
}

const selectFitnessTopWoman = async () => {
  await selectProduct("Top Feminino", 1, selectClothingWomanSubcategory, 'fitness-top-woman');
}

const selectShoesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('shoes-man-subcategory');
};

const selectShoesMan = async () => {
  await selectProduct("Tênis", 33, selectShoesManSubcategory, 'shoes-man');
};

const selectSlippersMan = async () => {
  await selectProduct("Chinelos", 1, selectShoesManSubcategory, 'slippers-man');
};

const selectSocksMan = async () => {
  await selectProduct("Meias Masculina", 9, selectShoesManSubcategory, 'socks-man');
};

const selectAccessoriesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('accessories-man-subcategory');
};

const selectCapsMan = async () => {
  await selectProduct("Bonés Masculino", 11, selectAccessoriesManSubcategory, 'caps-man');
};

const selectWalletsMan = async () => {
  await selectProduct("Carteiras Masculina", 7, selectAccessoriesManSubcategory, 'wallets-man');
}

const selectBeltsMan = async () => {
  await selectProduct("Cintos Masculino", 9, selectAccessoriesManSubcategory, 'belts-man');
}

const selectSweatshirtWoman = async () => {
  await selectProduct("Blusas Feminina", 1, selectClothingWomanSubcategory, 'sweatshirts-woman');
};

const selectSweatshirtSetChildren = async () => {
  await selectProduct("Conjuntos Moletom Infantil", 5, selectClothingChildrenSubcategory, 'sweatshirts-set-children')
}

module.exports = {
    selectSweatshirtsMan,
    selectTshirtsCasualMan,
    selectTshirtsDryFitMan,
    selectTshirtsPoloMan,
    selectDressShirtsMan,
    selectTankTopCasualMan,
    selectTankTopDryFitCasualMan,
    selectShortsBasicMan,
    selectShortsJeansMan,
    selectShortsSweatshortsMan,
    selectShortsTactelMan,
    selectPantsSweatpantsMan,
    selectPantsJeansMan,
    selectShoesMan,
    selectSlippersMan,
    selectSocksMan,
    selectCapsMan,
    selectWalletsMan,
    selectBeltsMan,
    selectSweatshirtWoman,
    selectSweatshirtSetChildren,
    selectShortsJeansWoman,
    selectPantsJeansWoman,
    selectFitnessLeggingWoman,
    selectFitnessTopWoman,
    selectUnderwearMan,
};