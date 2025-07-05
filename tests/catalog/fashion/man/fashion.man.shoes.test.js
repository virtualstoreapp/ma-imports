const {
  setupDesktop,
  setupMobile,
} = require('../../../utils/catalogCommon');

const {
  selectShoesMan,
  selectSlippersMan,
  selectSocksMan,
} = require('../../../utils/catalogActions');

describe('Fashion', () => {
    describe('Man', () => {
        describe('Shoes', () => {

            describe('Desktop View', () => {
                beforeEach(async () => {
                    await setupDesktop();
                });

                describe('Shoes', () => {
                    it('renders final subcategory "Tênis" correctly on desktop', async () => {
                        await selectShoesMan();
                    });
                });

                describe('Slipers', () => {
                    it('renders final subcategory "Chinelos" correctly on desktop', async () => {
                        await selectSlippersMan();
                    });
                });

                describe('Socks', () => {
                    it('renders final subcategory "Meias Masculina" correctly on desktop', async () => {
                        await selectSocksMan();
                    });
                });
            });

            describe('Mobile View', () => {
                beforeEach(async () => {
                    await setupMobile();
                });

                describe('Shoes', () => {
                    it('renders final subcategory "Tênis" correctly on mobile', async () => {
                        await selectShoesMan();
                    });
                });

                describe('Slipers', () => {
                    it('renders final subcategory "Chinelos" correctly on mobile', async () => {
                        await selectSlippersMan();
                    });
                });

                describe('Socks', () => {
                    it('renders final subcategory "Meias Masculina" correctly on mobile', async () => {
                        await selectSocksMan();
                    });
                });
            });
        });
    });
});
    