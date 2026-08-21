const express = require('express');
const path = require('path');

// Serves the source tree by default; `npm run preview` passes "dist" to check
// the built output exactly as GitHub Pages will publish it.
const root = path.resolve(__dirname, process.argv[2] || '.');

const app = express();

app.use(express.static(root));

app.get('/', (req, res) => {
    res.sendFile(path.join(root, 'index.html'));
});

const PORT = 8000;
app.listen(PORT, () => {
    console.log(`Serving ${root} on port ${PORT}`);
});
