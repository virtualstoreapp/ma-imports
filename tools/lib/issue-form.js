'use strict';

/**
 * Renders the "add a product" Issue Form from the registries.
 *
 * The form is generated rather than hand-written because its dropdowns *are* the
 * registries: a hand-maintained copy would become a second source of truth for
 * category and brand names, which is exactly the problem Wave 3 removed. The
 * build fails when the committed template is stale, which is what keeps the
 * registries load-bearing rather than decorative.
 *
 * Field labels here must match the labels tools/lib/authoring.js reads, since
 * GitHub renders each answer under its field label. The two are pinned together
 * by a test.
 *
 * No field carries a `placeholder`. GitHub silently refused to render the form
 * while they were present — it never appeared in the chooser and `?template=`
 * fell through to a blank issue, with no error anywhere to say why. The form was
 * valid by every rule GitHub documents and against the published issue-forms
 * schema, so it was found by bisection: probes that removed one dimension at a
 * time, and the one without placeholders was the one that rendered. Each hint
 * lives in its field's `description` instead, which is unaffected. Do not
 * reintroduce them without checking the chooser still lists the form.
 */

const { NO_BRAND_OPTION } = require('./authoring');

const TEMPLATE_PATH = '.github/ISSUE_TEMPLATE/add-product.yml';

// The label under which each answer appears in the issue body.
const FIELDS = {
  category: 'Categoria',
  brand: 'Marca',
  model: 'Modelo',
  price: 'Preço',
  oldPrice: 'Preço antigo',
  sizes: 'Tamanhos',
  sizeNote: 'Observação de tamanho',
  description: 'Descrição',
  photos: 'Fotos',
};

/**
 * Quotes a value as a YAML double-quoted scalar.
 * Everything is quoted rather than only what needs it, so a label containing
 * `&`, `#` or `:` cannot change the document's meaning.
 * @param {string} value Raw value.
 * @returns {string} A safely quoted scalar.
 */
const yaml = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Renders the Issue Form YAML.
 * @param {object} registry Output of loadRegistry.
 * @returns {string} The template contents.
 */
const renderIssueForm = (registry) => {
  const categories = registry.leaves.map((leaf) => leaf.label).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const brands = Object.entries(registry.brands)
    .filter(([slug]) => slug !== 'unbranded')
    .map(([, brand]) => brand.label)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const option = (value) => `        - ${yaml(value)}`;

  return [
    '# Generated from catalog/categories.json and catalog/brands.json by',
    '# `node tools/sync-issue-form.js`. Do not edit by hand; the build fails when',
    '# this file is stale. Add a category or brand to the registry and re-run.',
    'name: Adicionar produto',
    'description: Cadastrar um novo produto no catálogo',
    'title: "Novo produto: "',
    'labels: ["novo-produto"]',
    'body:',
    '  - type: markdown',
    '    attributes:',
    '      value: |',
    '        Preencha os campos abaixo e **anexe a foto do produto** no último campo.',
    '        Ao enviar, um robô cria a alteração e abre um Pull Request para revisão.',
    '',
    '  - type: dropdown',
    '    id: category',
    '    attributes:',
    `      label: ${yaml(FIELDS.category)}`,
    '      description: Onde o produto aparece no catálogo',
    '      options:',
    ...categories.map(option),
    '    validations:',
    '      required: true',
    '',
    '  - type: dropdown',
    '    id: brand',
    '    attributes:',
    `      label: ${yaml(FIELDS.brand)}`,
    `      description: Escolha ${yaml(NO_BRAND_OPTION)} se o produto não tem marca`,
    '      options:',
    option(NO_BRAND_OPTION),
    ...brands.map(option),
    '    validations:',
    '      required: true',
    '',
    '  - type: input',
    '    id: model',
    '    attributes:',
    `      label: ${yaml(FIELDS.model)}`,
    '      description: Linha do produto, quando houver. Por exemplo, Shox ou Campus',
    '',
    '  - type: input',
    '    id: price',
    '    attributes:',
    `      label: ${yaml(FIELDS.price)}`,
    '      description: Preço de venda, em reais. Por exemplo, 89,90',
    '    validations:',
    '      required: true',
    '',
    '  - type: input',
    '    id: old-price',
    '    attributes:',
    `      label: ${yaml(FIELDS.oldPrice)}`,
    '      description: Só preencha se o produto está com desconto. Precisa ser maior que o preço. Por exemplo, 129,90',
    '',
    '  - type: input',
    '    id: sizes',
    '    attributes:',
    `      label: ${yaml(FIELDS.sizes)}`,
    '      description: |',
    '        Os tamanhos disponíveis, separados por vírgula. Cada tamanho é uma peça:',
    '        se vender só uma, a peça sai do catálogo sozinha.',
    '        Deixe em branco para produtos sem tamanho, como bonés e carteiras.',
    '        Por exemplo: P, M, G',
    '',
    '  - type: input',
    '    id: size-note',
    '    attributes:',
    `      label: ${yaml(FIELDS.sizeNote)}`,
    '      description: |',
    '        Use no lugar de Tamanhos quando não for uma lista.',
    '        Por exemplo: Tamanho único, Consultar, 37 ao 44.',
    '',
    '  - type: textarea',
    '    id: description',
    '    attributes:',
    `      label: ${yaml(FIELDS.description)}`,
    '      description: |',
    '        Detalhes que aparecem no cartão do produto.',
    '        Por exemplo: Camiseta Dry Fit, Cor: Preta',
    '',
    '  - type: textarea',
    '    id: photos',
    '    attributes:',
    `      label: ${yaml(FIELDS.photos)}`,
    '      description: |',
    '        Arraste a foto para cá, ou toque para escolher da galeria.',
    '        Pode enviar duas: a primeira é a frente e a segunda o verso.',
    '    validations:',
    '      required: true',
    '',
  ].join('\n');
};

module.exports = { FIELDS, TEMPLATE_PATH, renderIssueForm };
