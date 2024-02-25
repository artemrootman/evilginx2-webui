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

    for (const line of fileLines) {
      if (line.includes('{') || line.includes('"custom":{')) {
        const item = JSON.parse(line)
        dataMap.set(item.id, item)
      }
    }
    const uniqueData = Array.from(dataMap.values())
    res.render('index.ejs', {
      data: uniqueData,
    })
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
