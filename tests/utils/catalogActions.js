"use strict";

const { fireEvent } = require('@testing-library/dom');
const { assertCategory } = require('./catalogAsserts');

// Product counts are derived from products/{slug}.json by assertCategory, so
// adding a product no longer means hand-editing a number in this file.

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
};

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
};

const selectShoesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('shoes-man-subcategory');
};

const selectAccessoriesManSubcategory = async () => {
  await selectManSubcategory();
  await selectMenuOption('accessories-man-subcategory');
};

/**
 * Navigates to a leaf category and asserts it rendered correctly.
 * @param {string} heading Expected category heading.
 * @param {Function} subcategoryFunction Navigation steps to reach the leaf.
 * @param {string} dataCategory data-category slug, matching products/{slug}.json.
 */
const selectProduct = async (heading, subcategoryFunction, dataCategory) => {
  await subcategoryFunction();
  await selectMenuOption(dataCategory);
  await assertCategory(heading, dataCategory);
};

const selectSweatshirtsMan = async () => {
  await selectProduct("Blusas Masculina", selectClothingManSubcategory, 'sweatshirts-man');
};

const selectTshirtsCasualMan = async () => {
  await selectProduct("Camisetas Casuais Masculina", selectClothingManSubcategory, 'tshirts-casual-man');
};

const selectTshirtsDryFitMan = async () => {
  await selectProduct("Camisetas Dry Fit Masculina", selectClothingManSubcategory, 'tshirts-dryfit-man');
};

const selectTshirtsPoloMan = async () => {
  await selectProduct("Camisetas Polo Masculina", selectClothingManSubcategory, 'tshirts-polo-man');
};

const selectDressShirtsMan = async () => {
  await selectProduct("Camisetas Sociais Masculina", selectClothingManSubcategory, 'dress-shirts-man');
};

const selectUnderwearMan = async () => {
  await selectProduct("Cuecas Masculina", selectClothingManSubcategory, 'underwear-man');
};

const selectTankTopCasualMan = async () => {
  await selectProduct("Regatas Casuais Masculina", selectClothingManSubcategory, 'tank-top-casual-man');
};

const selectTankTopDryFitCasualMan = async () => {
  await selectProduct("Regatas Dry Fit Masculina", selectClothingManSubcategory, 'tank-top-dryfit-man');
};

const selectShortsBasicMan = async () => {
  await selectProduct("Bermudas Básica Masculina", selectClothingManSubcategory, 'shorts-basic-man');
};

const selectShortsJeansMan = async () => {
  await selectProduct("Bermudas Jeans Masculina", selectClothingManSubcategory, 'shorts-jeans-man');
};

const selectShortsJeansWoman = async () => {
  await selectProduct("Bermudas Jeans Feminina", selectClothingWomanSubcategory, 'shorts-jeans-woman');
};

const selectShortsSweatshortsMan = async () => {
  await selectProduct("Bermudas Moletom Masculina", selectClothingManSubcategory, 'shorts-sweatshorts-man');
};

const selectShortsTactelMan = async () => {
  await selectProduct("Bermudas Tactel Masculina", selectClothingManSubcategory, 'shorts-tactel-man');
};

const selectPantsSweatpantsMan = async () => {
  await selectProduct("Calças Moletom Masculina", selectClothingManSubcategory, 'pants-sweatpants-man');
};

const selectPantsJeansMan = async () => {
  await selectProduct("Calças Jeans Masculina", selectClothingManSubcategory, 'pants-jeans-man');
};

const selectPantsJeansWoman = async () => {
  await selectProduct("Calças Jeans Feminina", selectClothingWomanSubcategory, 'pants-jeans-woman');
};

const selectFitnessLeggingWoman = async () => {
  await selectProduct("Calças Legging Feminina", selectClothingWomanSubcategory, 'fitness-legging-woman');
};

const selectFitnessTopWoman = async () => {
  await selectProduct("Top Feminino", selectClothingWomanSubcategory, 'fitness-top-woman');
};

const selectShoesMan = async () => {
  await selectProduct("Tênis", selectShoesManSubcategory, 'shoes-man');
};

const selectSlippersMan = async () => {
  await selectProduct("Chinelos", selectShoesManSubcategory, 'slippers-man');
};

const selectSocksMan = async () => {
  await selectProduct("Meias Masculina", selectShoesManSubcategory, 'socks-man');
};

const selectCapsMan = async () => {
  await selectProduct("Bonés Masculino", selectAccessoriesManSubcategory, 'caps-man');
};

const selectWalletsMan = async () => {
  await selectProduct("Carteiras Masculina", selectAccessoriesManSubcategory, 'wallets-man');
};

const selectBeltsMan = async () => {
  await selectProduct("Cintos Masculino", selectAccessoriesManSubcategory, 'belts-man');
};

const selectSweatshirtWoman = async () => {
  await selectProduct("Blusas Feminina", selectClothingWomanSubcategory, 'sweatshirts-woman');
};

const selectSweatshirtSetChildren = async () => {
  await selectProduct("Conjuntos Moletom Infantil", selectClothingChildrenSubcategory, 'sweatshirts-set-children');
};

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
