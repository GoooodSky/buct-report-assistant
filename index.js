const superagent = require('superagent')
const cheerio = require('cheerio')
const gm = require('gm')
const request = require('request')
const tesseract = require('node-tesseract')
const information = require('./information') //用于保存用户信息的脚本，请移步至information.js填写所需信息

//登录所需个人信息
var studentId = information.studentId
var studentPassword = information.studentPassword
//登录所需链接
var loginUrl = 'http://202.4.152.190:8080/pyxx/login.aspx'
var studentUrl =
  'http://202.4.152.190:8080/pyxx/txhdgl/hdlist.aspx?xh=' + studentId

var refreshFrequency = 1000 //报告刷新频率，毫秒计，建议不要低于1000ms，造成不必要的网络拥堵

//获取cookie和验证码
function getCookieAndCaptcha() {
  return new Promise((resolve, reject) => {
    //   获取验证码
    function getCaptcha() {
      var options = {
        url:
          'http://202.4.152.190:8080/pyxx/PageTemplate/NsoftPage/yzm/IdentifyingCode.aspx',
        headers: {
          Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,la;q=0.7,zh-TW;q=0.6',
          Connection: 'keep-alive',
          Cookie: cookie,
          Host: '202.4.152.190:8080',
          Referer: ' http://202.4.152.190:8080/pyxx/login.aspx',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36'
        }
      }
      //保存验证码
      gm(request(options))
        .threshold(44, '%') //调整阀值，降噪
        .crop(60, 25, 1, 1) //剪裁边框，原图有1像素黑色边框，影响识别
        .write('captcha.jpg', err => {
          if (err) console.log(err)
        })
    }
    var header = {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,la;q=0.7,zh-TW;q=0.6',
      'Cache-Control': 'max-age=0',
      Connection: ' keep-alive',
      Host: '202.4.152.190:8080',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36'
    }
    superagent
      .get(loginUrl)
      .set(header)
      .end(function(err, res) {
        if (err) {
          //   console.log(err.status)
          return
        }
        cookie = res.header['set-cookie'] //从response中得到cookie
        // emitter.emit("setCookeie");
        // console.log(res.text)
        resolve(cookie)
        getCaptcha(cookie)
      })
  })
}
//识别验证码
function recognizer() {
  return new Promise((resolve, reject) => {
    var option = {
      psm: 7
    }
    tesseract.process('captcha.jpg', option, function(err, txt) {
      captcha = txt.replace(/\s+/g, '').toUpperCase()
      resolve(captcha)
    })
  })
}
//登录并注册cookie
function login(cookie, captcha) {
  return new Promise((resolve, reject) => {
    var header = {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,la;q=0.7,zh-TW;q=0.6',
      'Cache-Control': 'max-age=0',
      Connection: 'keep-alive',
      'Content-Length': '405',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
      Host: '202.4.152.190:8080',
      Origin: 'http://202.4.152.190:8080',
      Referer: 'http://202.4.152.190:8080/pyxx/login.aspx',
      'Upgrade-Insecure-Requests': '1',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36'
    }
    superagent
      .post(loginUrl)
      .type('form')
      .set(header)
      .send({
        __VIEWSTATE:
          '/wEPDwUENTM4MWQYAQUeX19Db250cm9sc1JlcXVpcmVQb3N0QmFja0tleV9fFgEFEl9jdGwwOkltYWdlQnV0dG9uMQ0NODyO1wx8Du/Dppbl8bfJw0UTfwwIEHKsvYbP9Nqt',
        __EVENTVALIDATION:
          '/wEWBQKD7ogKAs351pYFAoWvzpoEAo/yj6QJAvejy/sN4orIb7P+pLUuRnP+SEJjmDK905Y49c5EptEPq4AmsvQ=',
        '_ctl0:txtusername': studentId,
        '_ctl0:txtpassword': studentPassword,
        '_ctl0:txtyzm': captcha,
        '_ctl0:ImageButton1.x': '0',
        '_ctl0:ImageButton1.y': '0'
      })
      .end(function(err, res) {
        if (err) {
          //   console.log(err.status)
          return
        }
        // cookie = res.header['cookie'] //从response中得到cookie
        // emitter.emit("setCookeie");
        // console.log(res.text)
        // console.log(res.status)
      })
  })
}
//查询报告
function queryReport(cookie) {
  return new Promise((resolve, reject) => {
    var existedReport = [] //存储已经输出信息的报告
    var ifReportExist = false //判断报告是否已经标记过，避免setInterval循环查询时多次输出
    // var ifErr = false //在恢复正常前只需输出一次错误，避免连续多次输出

    //判断是否已经发送消息，避免死循环式发送
    // function contains(obj, arr) {
    //   var i = arr.length
    //   while (i--) {
    //     if (arr[i] == obj) {
    //       return true
    //     }
    //   }
    //   return false
    // }
    // function removeContains(obj, arr) {
    //   var i = arr.length
    //   while (i--) {
    //     if (arr[i] == obj) {
    //       arr.splice(i, 1)
    //     }
    //   }
    // }
    //发送请求
    function sendRequest() {
      superagent
        .post(studentUrl)
        .set('Cookie', cookie)
        .end(function(err, pres) {
          if (err) {
            // if (ifErr == false) {
            // //   status = err.status
            //   //   console.log('StatusCode: ' + status)
            //   ifErr = true //发生错误了
            //   ifReportExist = false
            // }
            clearInterval(loop) //出现错误跳出循环
            reject(err)
            return
          }
          const $ = cheerio.load(pres.text, { decodeEntities: false })
          let reportList = []
          let reportTable = $('#dgData00 tbody tr')
          let reportCount = reportTable.length - 1

          for (let i = 0; i < reportCount; i++) {
            reportList[i] = {
              序号: i + 1,
              类别: reportTable
                .eq(i + 1)
                .children('td')
                .eq(0)
                .children()
                .html(),
              报告名称: reportTable
                .eq(i + 1)
                .children('td')
                .eq(1)
                .children()
                .html(),
              //   发布单位: reportTable
              //     .eq(i + 1)
              //     .children('td')
              //     .eq(2)
              //     .children()
              //     .html(),
              报告开始时间: reportTable
                .eq(i + 1)
                .children('td')
                .eq(3)
                .children()
                .html(),
              报告截止时间: reportTable
                .eq(i + 1)
                .children('td')
                .eq(4)
                .children()
                .html(),
              报告地点: reportTable
                .eq(i + 1)
                .children('td')
                .eq(5)
                .children()
                .html(),
              //   可报名人数: reportTable
              //     .eq(i + 1)
              //     .children('td')
              //     .eq(6)
              //     .children()
              //     .html(),
              剩余人数:
                reportTable
                  .eq(i + 1)
                  .children('td')
                  .eq(6)
                  .children()
                  .html() -
                reportTable
                  .eq(i + 1)
                  .children('td')
                  .eq(7)
                  .children()
                  .html()
              //   主办单位: reportTable
              //     .eq(i + 1)
              //     .children('td')
              //     .eq(8)
              //     .children()
              //     .html()
              //   报名开始时间: reportTable
              //     .eq(i + 1)
              //     .children('td')
              //     .eq(10)
              //     .children()
              //     .html(),
              //   报名截止时间: reportTable
              //     .eq(i + 1)
              //     .children('td')
              //     .eq(11)
              //     .children()
              //     .html()
            }
            //出现剩余名额先选后邮件通知
            // if (
            //   reportList[i].剩余人数 > 0 &&
            //   !contains(reportList[i].报告名称, existedReport)
            // )
            if (
              reportList[i].剩余人数 > 0 &&
              existedReport.indexOf(reportList[i]) === -1
            ) {
              let date = new Date()
              let now =
                date.getFullYear() +
                '/' +
                (date.getMonth() + 1) +
                '/' +
                date.getDate() +
                ' ' +
                ('0' + date.getHours()).slice(-2) +
                ':' +
                ('0' + date.getMinutes()).slice(-2) +
                ':' +
                ('0' + date.getSeconds()).slice(-2)
              reportDetail =
                now +
                '\n' +
                '获取到' +
                '【' +
                reportList[i].类别 +
                '】' +
                '\n' +
                '报告名称:' +
                reportList[i].报告名称 +
                '\n' +
                '报告开始时间:' +
                reportList[i].报告开始时间 +
                '\n' +
                '报告截止时间:' +
                reportList[i].报告截止时间 +
                '\n' +
                '报告地点:' +
                reportList[i].报告地点 +
                '\n' +
                '剩余人数:' +
                reportList[i].剩余人数 +
                '\n'
              console.log(reportDetail)
              existedReport.push(reportList[i].报告名称)
              ifReportExist = false
            }
            //如果报告被剩余人数为0，认为可能有人退报告，重新加入检测队列
            // if (
            //   reportList[i].剩余人数 == 0 &&
            //   contains(reportList[i].报告名称, existedReport)
            // ) {
            //   removeContains(reportList[i].报告名称, existedReport)
            // }
            if (
              reportList[i].剩余人数 > 0 &&
              existedReport.indexOf(reportList[i]) !== -1
            ) {
              existedReport.splice(i, 1)
            }
          }
          if (ifReportExist == false) {
            console.log('监测中...')
            ifReportExist = true
          }
        })
    }

    //查询循环，频率用refreshFrequency手动设置
    var loop = setInterval(sendRequest, refreshFrequency) //查询循环，频率用refreshFrequency手动设置
  })
}
//异步执行以上函数
;(function actions() {
  getCookieAndCaptcha().then(cookie => {
    recognizer().then(captcha => {
      login(cookie, captcha).then(
        queryReport(cookie).catch(err => {
          actions() //验证码识别错误或网络错误，重新执行整个步骤
        })
      )
    })
  })
})() //自执行，函数前分号不能省
