const {
  selectShoesMan,
} = require('../utils/catalogActions');

const {
  setupDesktop,
  fireEvent,
  waitFor,
} = require('../utils/catalogCommon');

describe('Modal Functionality', () => {
    beforeEach(async () => {
      await setupDesktop();
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

    it('copies the correct product ID and category to clipboard', async () => {
      const writeTextMock = jest.fn().mockResolvedValue();
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});

      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      const product = document.querySelector('#product-list .product-item');
      fireEvent.click(product);

      await waitFor(() => {
        expect(document.getElementById('product-modal')).toHaveStyle({ display: 'flex' });
      });

      const copyButton = document.getElementById('copy-product-id');
      fireEvent.click(copyButton);

      const categoryText = document.getElementById('category-heading').textContent;
      const productName = product.querySelector('h3').textContent;
      const expectedMessage = `Categoria: ${categoryText}, ID do Produto: ${productName}`;

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(expectedMessage);
        expect(alertMock).toHaveBeenCalledWith('ID copiado!');
      });

      alertMock.mockRestore();
    });

    it('shows error alert if clipboard copy fails', async () => {
      const writeTextMock = jest.fn().mockRejectedValue(new Error('Clipboard error'));
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextMock
        }
      });

      const product = document.querySelector('#product-list .product-item');
      fireEvent.click(product);

      await waitFor(() => {
        expect(document.getElementById('product-modal')).toHaveStyle({ display: 'flex' });
      });

      const copyButton = document.getElementById('copy-product-id');
      fireEvent.click(copyButton);

      const categoryText = document.getElementById('category-heading').textContent;
      const productName = product.querySelector('h3').textContent;
      const expectedMessage = `Categoria: ${categoryText}, ID do Produto: ${productName}`;

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledWith(expectedMessage);
        expect(alertMock).toHaveBeenCalledWith('Erro ao copiar. Tente novamente.');
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Falha ao copiar o ID:'),
          expect.any(Error)
        );
      });

      alertMock.mockRestore();
      errorSpy.mockRestore();
    });

  });
    