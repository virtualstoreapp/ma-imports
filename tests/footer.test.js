const fs = require('fs');
const path = require('path');
require('@testing-library/jest-dom');

describe('Footer CSS and Markup', () => {
  it('includes a CSS rule to center footer text', () => {
    const cssPath = path.resolve(__dirname, '../styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const normalized = cssContent.replace(/\s/g, '');
    expect(normalized).toMatch(/footer\{[^}]*text-align:center;[^}]*\}/);
  });

  it('renders footer markup as expected', () => {
    const htmlPath = path.resolve(__dirname, '../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    document.body.innerHTML = htmlContent;
    const footer = document.querySelector('footer');
    expect(footer).toBeInTheDocument();
    expect(footer.outerHTML).toMatchSnapshot();
  });
});
