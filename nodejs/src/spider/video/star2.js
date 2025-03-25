import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const url = 'https://xzys.fun'
const FIXED_PIC = 'https://bkimg.cdn.bcebos.com/pic/d1a20cf431adcbefe0769094aeaf2edda2cc9fe6'

const pq = (html) => {
  const jsp = new jsoup();
  return jsp.pq(html);
}
const classes = [
  {type_id: 'dsj', type_name: '电视剧', type_pic: FIXED_PIC},
  {type_id: 'dy', type_name: '电影', type_pic: FIXED_PIC},
  {type_id: 'dm', type_name: '动漫', type_pic: FIXED_PIC},
  {type_id: 'jlp', type_name: '纪录片', type_pic: FIXED_PIC},
  {type_id: 'zy', type_name: '综艺', type_pic: FIXED_PIC},
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
    const pg = inReq.body.page || 1;
    const id = inReq.body.tid;

    const categoryUrl = `${url}/${id}_${pg}`
    const { data } = await req.get(categoryUrl, {
        headers: {
            'User-Agent': PC_UA,
        },
    });

    const $ = new jsoup().pq(data);

    const videos = $('div.a');
    const cards = [];

    videos.each((_, e) => {
        const href = $(e).find('a.main').attr('href');
        const title = $(e).find('a.main').text();
        const match1 = title.match(/\.(.*?)$/);
        const remarks = match1 && match1[1] ? match1[1] : ''; 
        const match = title.match(/】(.*?)\./);
        const dramaName = match && match[1] ? match[1] : title; 

        cards.push({
            vod_id: href,
            vod_name: dramaName,
            vod_remarks: remarks,
            vod_pic: FIXED_PIC,
            ext: {
                url: `${url}${href}`,
            },
        });
    });

    return {
        page: pg,
        pagecount: 1,
        list: cards,
    };
}

async function detail(inReq, _outResp) {
    const detailUrl = `${url}${inReq.body.id}`;
    const { data } = await req.get(detailUrl, {
        headers: {
            'User-Agent': PC_UA,
        },
    });

    const $ = new jsoup().pq(data);

    const playlist = $('.dlipp-cont-bd');
    let panShareUrl = '';
    playlist.each((_, e) => {
        panShareUrl = $(e).find('a').attr('href');
    });

    const vodFromUrl = await _detail(panShareUrl);
    
    const vod = {
        vod_id: inReq.body.id,
        vod_name: $('h1').text().trim(),
        vod_play_from: vodFromUrl ? vodFromUrl.froms : '',
        vod_play_url: vodFromUrl ? vodFromUrl.urls : '',
        vod_pic: FIXED_PIC,
    };

    return {
        list: [vod],
    };
}

async function search(inReq, _outResp) {
    const pg = inReq.body.page || 1;
    const wd = inReq.body.wd;
    
    let text = encodeURIComponent(wd);
    let searchUrl = `${url}/search/?keyword=${text}&page=${pg}`

    const { data } = await req.get(searchUrl, {
        headers: {
            'User-Agent': PC_UA,
        },
    });

    const $ = new jsoup().pq(data);
    
    const videos = $('div.a');
    const cards = [];

    videos.each((_, e) => {
        const href = $(e).find('a.main').attr('href');
        const title = $(e).find('a.main').text();
        const match1 = title.match(/\.(.*?)$/);
        const remarks = match1 && match1[1] ? match1[1] : ''; 
        const match = title.match(/】(.*?)\./);
        const dramaName = match && match[1] ? match[1] : title; 

        cards.push({
            vod_id: href,
            vod_name: dramaName,
            vod_remarks: remarks,
            vod_pic: FIXED_PIC,
            ext: {
                url: `${url}${href}`,
            },
        });
    });

    return {
        page: pg,
        pagecount: 1,
        list: cards,
    };
}

export default {
    meta: {
        key: 'star2',
        name: '星剧社(仅搜)',
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
}
