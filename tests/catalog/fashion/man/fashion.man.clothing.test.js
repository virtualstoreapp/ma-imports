const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
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
  selectUnderwearMan
} = require('../../../utils/catalogActions');

describe('Fashion', () => {
    describe('Man', () => {
        describe('Clothing', () => {

            describe('Desktop View', () => {
                beforeEach(async () => {
                    await setupDesktop();
                });

                describe('Shorts', () => {
                    it('renders final subcategory "Bermudas Básica Masculina" correctly on desktop', async () => {
                        await selectShortsBasicMan();
                    });

                    it('renders final subcategory "Bermudas Jeans Masculina" correctly on desktop', async () => {
                        await selectShortsJeansMan();
                    });

                    it('renders final subcategory "Bermudas Moletom Masculina" correctly on desktop', async () => {
                        await selectShortsSweatshortsMan();
                    });

                    it('renders final subcategory "Bermudas Tactel Masculina" correctly on desktop', async () => {
                        await selectShortsTactelMan();
                    });
                });

                describe('Sweatshirts', () => {
                    it('renders final subcategory "Blusas Masculina" correctly on desktop', async () => {
                        await selectSweatshirtsMan();
                    });
                });

                describe('Pants', () => {
                    it('renders final subcategory "Calça Moletom Masculina" correctly on desktop', async () => {
                        await selectPantsSweatpantsMan();
                    });

                    it('renders final subcategory "Calça Jeans Masculina" correctly on desktop', async () => {
                        await selectPantsJeansMan();
                    });
                });

                describe('Tshirts', () => {
                    it('renders final subcategory "Camisetas Casuais Masculina" correctly on desktop', async () => {
                        await selectTshirtsCasualMan();
                    });

                    it('renders final subcategory "Camisetas Dry Fit Masculina" correctly on desktop', async () => {
                        await selectTshirtsDryFitMan();
                    });

                    it('renders final subcategory "Camisetas Polo Masculina" correctly on desktop', async () => {
                        await selectTshirtsPoloMan();
                    });

                    it('renders final subcategory "Camisetas Sociais Masculina" correctly on desktop', async () => {
                        await selectDressShirtsMan();
                    });
                });

                describe('Underwear', () => {
                    it('renders final subcategory "Cuecas Masculina" correctly on desktop', async () => {
                        await selectUnderwearMan();
                    });
                });

                describe('Tank Top', () => {
                    it('renders final subcategory "Regatas Casuais Masculina" correctly on desktop', async () => {
                        await selectTankTopCasualMan();
                    });

                    it('renders final subcategory "Regatas Dry Fit Masculina" correctly on desktop', async () => {
                        await selectTankTopDryFitCasualMan();
                    });
                });
            });

            describe('Mobile View', () => {
                beforeEach(async () => {
                    await setupMobile();
                });

                describe('Shorts', () => {
                    it('renders final subcategory "Bermudas Básica Masculina" correctly on mobile', async () => {
                        await selectShortsBasicMan();
                    });

                    it('renders final subcategory "Bermudas Jeans Masculina" correctly on mobile', async () => {
                        await selectShortsJeansMan();
                    });

                    it('renders final subcategory "Bermudas Moletom Masculina" correctly on mobile', async () => {
                        await selectShortsSweatshortsMan();
                    });

                    it('renders final subcategory "Bermudas Tactel Masculina" correctly on mobile', async () => {
                        await selectShortsTactelMan();
                    });
                });

                describe('Sweatshirts', () => {
                    it('renders final subcategory "Blusas Masculina" correctly on mobile', async () => {
                        await selectSweatshirtsMan();
                    });
                });

                describe('Pants', () => {
                    it('renders final subcategory "Calça Moletom Masculina" correctly on mobile', async () => {
                        await selectPantsSweatpantsMan();
                    });

                    it('renders final subcategory "Calça Jeans Masculina" correctly on mobile', async () => {
                        await selectPantsJeansMan();
                    });
                });

                describe('Tshirts', () => {
                    it('renders final subcategory "Camisetas Casuais Masculina" correctly on mobile', async () => {
                        await selectTshirtsCasualMan();
                    });

                    it('renders final subcategory "Camisetas Dry Fit Masculina" correctly on mobile', async () => {
                        await selectTshirtsDryFitMan();
                    });

                    it('renders final subcategory "Camisetas Polo Masculina" correctly on mobile', async () => {
                        await selectTshirtsPoloMan();
                    });

                    it('renders final subcategory "Camisetas Sociais Masculina" correctly on mobile', async () => {
                        await selectDressShirtsMan();
                    });
                });

                describe('Underwear', () => {
                    it('renders final subcategory "Cuecas Masculina" correctly on mobile', async () => {
                        await selectUnderwearMan();
                    });
                });

                describe('Tank Top', () => {
                    it('renders final subcategory "Regatas Casuais Masculina" correctly on mobile', async () => {
                        await selectTankTopCasualMan();
                    });

                    it('renders final subcategory "Regatas Dry Fit Masculina" correctly on mobile', async () => {
                        await selectTankTopDryFitCasualMan();
                    });
                });
            });
        });
    });
});
    