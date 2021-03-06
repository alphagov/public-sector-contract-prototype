var helpers = require('./helpers');
var express = require('express');
var router  = express.Router();
var yaml    = require('js-yaml');
var fs      = require('fs-extra');

schedules = {
  'v2': yaml.safeLoad(fs.readFileSync('./app/views/v2/schedules.yml', 'utf8')),
  'v3': yaml.safeLoad(fs.readFileSync('./app/views/v3/schedules.yml', 'utf8')),
}

content = yaml.safeLoad(fs.readFileSync('./app/views/v4/content.yml', 'utf8'))

// Route index page
router.get('/', function (req, res) {
  res.render('index')
})

// add your routes here

// v4 routes

router.get('/v4', function (req, res) {
  if (req.session.data.role === undefined) {
    res.redirect('/v4/role')
  } else {
    req.session.data.visited = []

    if (req.query.supplier_submitted) {
      req.session.data.supplier_submitted = true
    }

    data = req.session.data

    console.log(`*********\n`)
    console.log(data)
    console.log(`*********\n`)

    res.render('v4/overview', {
      order_form: data,
      content: content.overview,
      supplier_edit: req.query.supplier_edit,
      supplier_signatory_invited: req.query.supplier_signatory_invited,
      supplier_submitted: req.query.supplier_submitted,
      signed: req.query.signed
    })
  }
})

router.get('/v4/back', function (req, res) {
  if (req.session.data.visited.pop() === "4-0")
    previous_page = "/"
  else if (req.session.data.visited.length === 1) {
    previous_page = "/v4"
  } else {
    previous_page = `/v4/${req.session.data.visited.splice(-2, 2)[0]}`
  }

  res.redirect(previous_page)
})

router.get('/v4/:page', function (req, res) {
  if (req.session.data.visited === undefined) {
    req.session.data.visited = []
  }
  req.session.data.visited.push(req.params.page)

  res.render('v4/base', {
    header: req.params.page,
    page: req.params.page,
    order_form: req.session.data,
    content: content,
    added: req.query.added,
    review: req.query.review,
    edit: req.query.edit
  })
})

router.post('/v4/:page', function (req, res) {
  page = req.params.page
  data = req.session.data

  if (page === 'signatory') {
    data[`${data.role}_${page}_complete`] = true
  } else {
    data[`${page}_complete`] = true
  }

  if (data.policies_complete && data.terms_complete && data.sensitive_complete) {
    data.complete = true
  }

  helpers.addItem(data)
  path = helpers.setPath({
    page: page,
    review: req.query.review,
    additional_policy: req.body.additional_policy
  })

  query = helpers.setQuery({
    page: page,
    role: data.role,
    review: req.query.review,
    edit: req.query.edit
  })

  res.redirect(`/v4${path}${query}`)
})

router.get('/v4/add/:type', function (req, res) {
  type = req.params.type

  res.render('v4/base', {
    header: type,
    page: type === 'policy' ? 'policy' : 'representative',
    type: type,
    content: content,
    cancel_path: `/v4${helpers.setPath({ type: type })}`,
    review: req.query.review
  })
})

router.post('/v4/add/:type', function (req, res) {
  type = req.params.type
  data = req.session.data
  helpers.addItem(data)

  added_item = helpers.added(data, type) ? type : ''
  if (added_item) {
    helpers.addStaffOrSubcontractors(data, type)
    helpers.cleanKeys(data)
  }

  path = helpers.setPath({ type: type })
  query = helpers.setQuery({ review: req.query.review, added: added_item })
  res.redirect(`/v4${path}${query}`)
})

router.get('/v4/edit/:type/:id', function (req, res) {
  type = req.params.type
  rep_index = helpers.findRepIndex(req.session.data, type, req.params.id)

  res.render('v4/base', {
    header: type,
    page: 'representative',
    type: type,
    rep: req.session.data[type][rep_index],
    content: content,
    cancel_path: `/v4${helpers.setPath({ type: type })}`
  })
})

router.post('/v4/edit/:type/:id', function (req, res) {
  type = req.params.type
  data = req.session.data

  rep_index = helpers.findRepIndex(data, type, req.params.id)
  id = req.session.data[type][rep_index].id
  req.session.data[type].splice(rep_index, 1)
  helpers.addStaffOrSubcontractors(data, type, id)

  path = helpers.setPath({ type: type })
  res.redirect(`/v4${path}`)
})

// v2 and v3 routes

router.get('/:version(v2|v3)/what-is-the-public-sector-contract', function (req, res) {
  res.render(
    `${req.params.version}/what-is-the-public-sector-contract`,
    { schedules: schedules[req.params.version] }
  )
})

router.get('/:version(v2|v3)/contract', function (req, res) {
  if (req.session.data['optionalIncluded'] == undefined) {
    req.session.data['optionalIncluded'] = []
  }

  res.render(
    `${req.params.version}/contract`,
    {
      schedules: schedules[req.params.version],
      optionalIncluded: req.session.data['optionalIncluded'],
      updated: req.query.updated,
      invited: req.query.invited
    }
  )
})

router.post('/:version(v2|v3)/team-members', function (req, res) {
  email = req.session.data['email']
  role = req.session.data['role']

  if (req.session.data['teammembers'] == undefined) {
    req.session.data['teammembers'] = []
  }

  req.session.data['teammembers'].push({
    email: email,
    role: role
  })

  res.redirect(`/${req.params.version}/contract?invited=true`)
})

router.get('/:version(v2|v3)/schedule/:scheduleId', function (req, res) {
  res.render(`${req.params.version}/schedule`, {
    schedule: helpers.findScheduleById(req.params['scheduleId'], req.params.version),
    preview: req.query.preview
  })
})

router.get('/:version(v2|v3)/schedule/:scheduleId/:addOrRemove', function (req, res) {
  res.render(`${req.params.version}/add-remove-schedule`, {
    schedule: helpers.findScheduleById(req.params['scheduleId'], req.params.version),
    addOrRemove: req.params['addOrRemove']
  })
})

router.post('/:version(v2|v3)/schedule/:scheduleId/:addOrRemove', function (req, res) {
  scheduleId = Number(req.params['scheduleId'])
  addOrRemove = req.params['addOrRemove']

  if (req.session.data['optionalIncluded'] == undefined) {
    req.session.data['optionalIncluded'] = []
  }

  if (addOrRemove == 'add') {
    req.session.data['optionalIncluded'].push(scheduleId)
  }

  if (addOrRemove == 'remove') {
    req.session.data['optionalIncluded'].splice(
      req.session.data['optionalIncluded'].indexOf(scheduleId, 1)
    )
  }

  console.log(req.session.data['optionalIncluded'])
  res.redirect(`/${req.params.version}/contract?updated=true`)
})

module.exports = router
