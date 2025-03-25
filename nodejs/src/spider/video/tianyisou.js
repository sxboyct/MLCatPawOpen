import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const cheerio = createCheerio();
const CryptoJS = createCryptoJS();

async function getHtml(config) {
  try {
    return await axios.request(typeof config === "string" ? config : {
      url: config.url,
      method: config.method || 'GET',
      headers: config.headers || {
        'User-Agent': PC_UA,
        'Referer': 'https://www.tianyiso.com/',
        'Origin': 'https://www.tianyiso.com'
      },
      data: config.data || '',
      responseType: config.responseType || '',
    })
  } catch (e) {
    return e.response
  }
}

async function request(reqUrl) {
  const resp = await req.get(reqUrl, {
    headers: {
      'User-Agent': PC_UA,
      'Referer': 'https://www.tianyiso.com/',
      'Origin': 'https://www.tianyiso.com'
    },
  });
  return resp.data;
}

const pq = (html) => {
  const jsp = new jsoup();
  return jsp.pq(html);
}

const appConfig = {
  site: "https://www.tianyiso.com",
}

async function home(_inReq, _outResp) {
  let classes = [
    {type_id: '搜索', type_name: '天逸搜索'},
  ];
  let filterObj = {};
  return ({
    class: classes,
    filters: filterObj,
  });
}

async function category(inReq, _outResp) {
  const pg = inReq.body.page;
  let page = pg || 1;
  if (page == 0) page = 1;
  
  return ({
    page: parseInt(page),
    pagecount: 1,
    limit: 0,
    total: 0,
    list: [],
  });
}

async function detail(inReq, _outResp) {
  const url = appConfig.site + inReq.body.id;
  let html = await request(url);
  const $ = pq(html);
  
  let pan = html.match(/"(https:\/\/cloud\.189\.cn\/t\/.*)",/)[1];
  
  let vod = {
    "vod_name": $('template').first().text().trim(),
    "vod_id": inReq.body.id,
    "vod_play_from": "网盘",
    "vod_play_url": pan,
  }

  return {
    list: [vod],
  };
}

async function search(inReq, _outResp) {
  const pg = inReq.body.page || 1;
  const wd = inReq.body.wd;
  
  if (pg > 1) {
    return {
      page: pg,
      pagecount: 1,
      list: [],
    };
  }

  const url = appConfig.site + `/search?k=${encodeURIComponent(wd)}`
  let html = (await getHtml(url)).data;
  const $ = pq(html);
  
  let videos = [];
  $('a').each((_, each) => {
    const path = $(each).attr('href') ?? ''
    if (path.startsWith('/s/')) {
      videos.push({
        "vod_name": $(each).find('template').first().text().trim(),
        "vod_id": path,
        "vod_remarks": '',
        "vod_pic": ''
      })
    }
  })

  return {
    page: pg,
    pagecount: 1,
    list: videos,
  };
}

export default {
  meta: {
    key: 'tianyiso',
    name: '天逸搜',
    type: 3,
  },
  api: async (fastify) => {
    fastify.post('/init', init);
    fastify.post('/home', home);
    fastify.post('/category', category);
    fastify.post('/detail', detail);
    fastify.post('/play', play);
    fastify.post('/search', search);
    fastify.get('/proxy/:site/:what/:flag/:shareId/:fileId/:end', proxy);
  },
};