const express = require('express')
const cors = require('cors')
const path = require('path')
const app = express()
/* const fs = require('fs') */
const port = 3000

app.use(cors())

/* app.get('/obj', async (req, res) => {
    const text = fs.readFileSync('./models/EARTH.obj', 'utf8')
    res.send(text)
})

app.get('/mtl', async (req, res) => {
    const text = fs.readFileSync('./models/EARTH.mtl', 'utf8')
    res.send(text)
})
 */
app.get('/img', function (req, res) {
    const options = {
        root: path.join(__dirname + "/models/")
    };
    const fileName = '3884071286_edb50f8137_b.jpeg';
    res.sendFile(fileName, options, function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('Sent:', fileName);
        }
    });
});

app.listen(port, () => {
  console.log(`Servidor rodando.`)
})