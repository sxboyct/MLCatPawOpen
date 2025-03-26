import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";
import {Yun} from "../../util/yun.js";

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/604.1.14 (KHTML, like Gecko)';
const url = 'https://www.gying.org';

async function getHtml(config) {
  try {
    return await axios.request(typeof config === "string" ? config : {
      url: config.url,
      method: config.method || 'GET',
      headers: config.headers || {
        'User-Agent': UA
      },
      data: config.data || '',
      responseType: config.responseType || '',
    })
  } catch (e) {
    return e.response
  }
}

async function request(reqUrl, options = {}) {
  const resp = await req.get(reqUrl, {
    headers: {
      'User-Agent': UA,
      ...options.headers
    },
    ...options
  });
  return resp.data;
}

async function login() {
  const loginUrl = `${url}/user/login`;
  const loginData = {
    siteid: '1',
    dosubmit: '1',
    cookietime: '10506240',
    username: 'sxboyc',
    password: 'NP8Gpx0jPU1b0j'
  };

  try {
    const response = await axios.post(loginUrl, new URLSearchParams(loginData), {
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxRedirects: 0
    });
    return response.headers['set-cookie'];
  } catch (error) {
    console.error('Login failed:', error);
    return null;
  }
}

const classes = [
  {type_id: '/mv/------', type_name: '电影'},
  {type_id: '/tv/------', type_name: '剧集'},
  {type_id: '/ac/------', type_name: '动漫'}
];

const tags = classes.map(item => item.type_name);

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

  const loginCookies = await login();
  let html = await request(`${url}${tid}${page}`, {
    headers: {
      'Cookie': loginCookies ? loginCookies.join('; ') : ''
    }
  });

  const $ = new jsoup().pq(html);
  let videos = [];

  const scriptContent = $('script').filter((_, script) => 
    script.children[0]?.data.includes('_obj.header')
  )[0].children[0].data;

  const jsonStart = scriptContent.indexOf('{');
  const jsonEnd = scriptContent.lastIndexOf('}') + 1;
  const jsonString = scriptContent.slice(jsonStart, jsonEnd);

  const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
  if (inlistMatch) {
    const inlistData = JSON.parse(inlistMatch[1]);
    
    inlistData["i"].forEach((item, index) => {
      videos.push({
        "vod_name": inlistData["t"][index],
        "vod_id": item,
        "vod_pic": `https://s.tutu.pm/img/${inlistData["ty"]}/${item}.webp`,
        "vod_remarks": inlistData["g"][index]
      });
    });
  }

  return ({
    page: parseInt(page),
    pagecount: 1,
    limit: videos.length,
    total: videos.length,
    list: videos,
  });
}

async function detail(inReq, _outResp) {
  const loginCookies = await login();
  const detailUrl = `${url}/res/downurl${inReq.body.id}`;
  let detailResp = await request(detailUrl, {
    headers: {
      'Cookie': loginCookies ? loginCookies.join('; ') : ''
    }
  });

  const respstr = JSON.parse(detailResp);
  let vod = {
    "vod_name": inReq.body.id,
    "vod_id": inReq.body.id,
  };

  if (respstr.hasOwnProperty('panlist')) {
    vod.vod_play_from = '网盘';
    vod.vod_play_url = respstr.panlist.url.join('$');
  }

  return {
    list: [vod],
  };
}

async function play(inReq, _outResp) {
  return {
    url: inReq.body.url
  };
}

async function search(inReq, _outResp) {
  const pg = inReq.body.page || 1;
  const wd = inReq.body.wd;
  
  const loginCookies = await login();
  let html = await request(`${url}/s/1---${pg}/${encodeURIComponent(wd)}`, {
    headers: {
      'Cookie': loginCookies ? loginCookies.join('; ') : ''
    }
  });

  const $ = new jsoup().pq(html);
  let videos = [];

  $('.v5d').each((index, element) => {
    const name = $(element).find('b').text().trim() || 'N/A';
    const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 'N/A';
    const additionalInfo = $(element).find('p').text().trim() || 'N/A';
    const pathMatch = $(element).find('a').attr('href') || 'N/A';

    videos.push({
      "vod_name": name,
      "vod_id": pathMatch,
      "vod_remarks": additionalInfo,
      "vod_pic": imgUrl,
    });
  });

  return {
    page: pg,
    pagecount: 1,
    list: videos,
  };
}

export default {
  meta: {
    key: 'guanying',
    name: '观影网',
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