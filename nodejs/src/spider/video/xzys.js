import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const url = 'https://xzys.fun'

const pq = (html) => {
  const jsp = new jsoup();
  return jsp.pq(html);
}

const classes = [
  {type_id: 'dsj', type_name: '电视剧'},
  {type_id: 'dy', type_name: '电影'},
  {type_id: 'dm', type_name: '动漫'},
  {type_id: 'jlp', type_name: '纪录片'},
  {type_id: 'zy', type_name: '综艺'},
]

const tags = classes.map(item => item.type_name)

async function request(reqUrl, options = {}) {
  const resp = await req.get(reqUrl, {
    headers: {
      'User-Agent': PC_UA,
      ...options.headers
    },
    ...options
  });
  return resp.data;
}

async function home(_inReq, _outResp) {
  let filterObj = {};
  return ({
    class: classes,
    filters: filterObj,
  });
}

async function category(inReq, _outResp) {
  const tid = inReq.body.id;
  const pg = inReq.body.page;
  let page = pg || 1;
  if (page == 0) page = 1;
  
  let html = await request(`${url}/${tid}.html?page=${page}`)
  const $ = pq(html)
  let videos = []
  
  $('.container .list-boxes .left_ly a').each((_, e) => {
    const href = $(e).attr('href')
    const title = $(e).find('img').attr('alt')
    const cover = $(e).find('img').attr('src')
    
    if (title === '网盘选择问题') return
    
    videos.push({
      "vod_name": title,
      "vod_id": href,
      "vod_pic": cover,
    })
  })
  
  const pageInfo = $('.pages')[0]
  const pageLinks = $(pageInfo).find('a')
  const lastPageLink = pageLinks.last()
  const totalPages = lastPageLink.length > 0 ? parseInt(lastPageLink.text()) : 1
  
  return ({
    page: parseInt(page),
    pagecount: totalPages,
    limit: videos.length,
    total: videos.length * totalPages,
    list: videos,
  });
}

async function detail(inReq, _outResp) {
  let html = await request(`${url}/${inReq.body.id}`);
  const $ = pq(html);
  
  let vod = {
    "vod_name": $('.article-title').text().trim(),
    "vod_id": inReq.body.id,
  };

  let tracks = [];
  $('.col-md-9 .article-box p').each((_, e) => {
    const name = $(e).find('.btn-info').text().trim();
    const panShareUrl = $(e).find('button.btn-info').attr('data-pan'); // 修改此处

    if (/夸克|阿里|UC|115|天翼/.test(name) && panShareUrl) {
      tracks.push({
        name: name,
        pan: panShareUrl,
      });
    }
  });

  if (tracks.length > 0) {
    const vodFromUrl = await _detail(tracks[0].pan);
    if (vodFromUrl) {
      vod.vod_play_from = vodFromUrl.froms;
      vod.vod_play_url = vodFromUrl.urls;
    }
  }

  return {
    list: [vod],
  };
}

async function search(inReq, _outResp) {
  const pg = inReq.body.page || 1;
  const wd = inReq.body.wd;
  
  let html = await request(`${url}/search.html?keyword=${encodeURIComponent(decodeURIComponent(wd))}&page=${pg}`)
  const $ = pq(html)
  
  let videos = []
  
  $('#container .list-boxes .left_ly a').each((_, e) => {
    const href = $(e).attr('href')
    const title = $(e).find('img').attr('alt')
    const cover = $(e).find('img').attr('src')
    
    videos.push({
      "vod_name": title,
      "vod_id": href,
      "vod_remarks": '',
      "vod_pic": cover,
    })
  })
  
  return {
    page: pg,
    pagecount: 1,
    list: videos,
  };
}

export default {
  meta: {
    key: 'xzys',
    name: '校长影视',
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
