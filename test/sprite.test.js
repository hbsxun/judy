var app = require('../app')
var request = require('supertest')
var User = require('../models/user')
var Upload = require('../models/upload')
var Sprite = require('../models/sprite')
var should = require('chai').should() // eslint-disable-line no-unused-vars


describe('符号库模块', function() {

  var access_token
  var sprite_id

  before('注册用户', function(done) {
    request(app)
      .post('/api/v1/users')
      .send({ username: 'nick', password: '123456' })
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }

        access_token = res.body.access_token

        done()
      })
  })

  after('清除用户以及用户样式表信息', function() {
    User.remove({ username: 'nick' }).exec()
    Upload.remove({ owner: 'nick' }).exec()
    Sprite.remove({ owner: 'nick' }).exec()
  })

  describe('上传符号库文件', function() {
    it('上传成功', function(done) {
      request(app)
        .post('/api/v1/uploads/nick')
        .set('x-access-token', access_token)
        .attach('aa', './test/fixtures/sprite.zip')
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.body.owner.should.equal('nick')
          res.body.upload_id.should.exist

          done()
        })
    })
  })

  describe('获取符号库列表', function() {
    it('获取成功', function(done) {
      request(app)
        .get('/api/v1/sprites/nick')
        .set('x-access-token', access_token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.body[0].owner.should.equal('nick')
          res.body[0].sprite_id.should.exist

          sprite_id = res.body[0].sprite_id

          done()
        })
    })
  })

  describe('下载符号库', function() {
    it('@2x', function(done) {
      request(app)
        .get('/api/v1/sprites/nick/' + sprite_id + '@2x')
        .set('x-access-token', access_token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.body.london.pixelRatio.should.equal(2)

          done()
        })
    })

    it('@1x', function(done) {
      request(app)
        .get('/api/v1/sprites/nick/' + sprite_id)
        .set('x-access-token', access_token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.body.london.pixelRatio.should.equal(1)

          done()
        })
    })

    it('@2x.json', function(done) {
      request(app)
        .get('/api/v1/sprites/nick/' + sprite_id + '@2x.json')
        .set('x-access-token', access_token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.body.london.pixelRatio.should.equal(2)

          done()
        })
    })

    it('@1x.json', function(done) {
      request(app)
        .get('/api/v1/sprites/nick/' + sprite_id + '.json')
        .set('x-access-token', access_token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.body.london.pixelRatio.should.equal(1)

          done()
        })
    })

    it('@2x.png', function(done) {
      request(app)
        .get('/api/v1/sprites/nick/' + sprite_id + '@2x.png')
        .set('x-access-token', access_token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.header['content-length'].should.equal('99217')

          done()
        })
    })

    it('@1x.png', function(done) {
      request(app)
        .get('/api/v1/sprites/nick/' + sprite_id + '.png')
        .set('x-access-token', access_token)
        .expect(200)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }

          res.header['content-length'].should.equal('99217')

          done()
        })
    })

    it('下载不存在的符号库', function() {
      request(app)
        .get('/api/v1/sprites/nick/un_exist_sprite_id')
        .set('x-access-token', access_token)
        .expect(404)
    })
  })

  describe('删除符号库', function() {
    it('删除成功', function() {
      request(app)
        .delete('/api/v1/sprites/nick/' + sprite_id)
        .set('x-access-token', access_token)
        .expect(204)
    })
  })
})
