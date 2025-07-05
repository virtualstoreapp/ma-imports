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

const selectClothingManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('clothing-man-subcategory');
};

const selectClothingWomanSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('clothing-woman-subcategory');
};


const selectSweatshirtMan = async () => {
  const expectedHeading = "Blusas Masculina";
  const expectedCount = 14;
  await selectClothingManSubcategory();
  await selectMenuOption('sweatshirts-man');
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

const selectDressShirtsMan = async () => {
  const expectedHeading = "Camisetas Sociais Masculina";
  const expectedCount = 5;
  await selectClothingManSubcategory();
  await selectMenuOption('dress-shirts-man');
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

const selectShortsSweatshortsMan = async () => {
  const expectedHeading = "Bermudas Moletom Masculina";
  const expectedCount = 8;
  await selectClothingManSubcategory();
  await selectMenuOption('shorts-sweatshorts-man');
  await asserts(expectedHeading, expectedCount);
};

const selectShortsTactelMan = async () => {
  const expectedHeading = "Bermudas Tactel Masculina";
  const expectedCount = 14;
  await selectClothingManSubcategory();
  await selectMenuOption('shorts-tactel-man');
  await asserts(expectedHeading, expectedCount);
};

const selectShortsSweatpantsMan = async () => {
    const expectedHeading = "Calças Moletom Masculina";
    const expectedCount = 3;
    await selectClothingManSubcategory();
    await selectMenuOption('sweatpants-man');
    await asserts(expectedHeading, expectedCount);
}

const selectShoesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('shoes-man-subcategory');
};

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

const selectSocksMan = async () => {
  const expectedHeading = "Meias Masculina";
  const expectedCount = 7;
  await selectShoesManSubcategory();
  await selectMenuOption('socks-man');
  await asserts(expectedHeading, expectedCount);
};

const selectAccessoriesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('accessories-man-subcategory');
};

const selectCapsMan = async () => {
  const expectedHeading = "Bonés Masculino";
  const expectedCount = 5;
  await selectAccessoriesManSubcategory();
  await selectMenuOption('caps-man');
  await asserts(expectedHeading, expectedCount);
};

const selectSweatshirtWoman = async () => {
  const expectedHeading = "Blusas Feminina";
  const expectedCount = 1;
  await selectClothingWomanSubcategory();
  await selectMenuOption('sweatshirts-woman');
  await asserts(expectedHeading, expectedCount);
};

module.exports = {
    selectSweatshirtMan,
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
    selectShortsSweatpantsMan,
    selectShoesMan,
    selectSlippersMan,
    selectSocksMan,
    selectCapsMan,
    selectSweatshirtWoman
};