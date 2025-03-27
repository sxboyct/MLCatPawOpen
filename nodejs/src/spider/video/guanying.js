import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const url = 'https://www.gying.org/'
const headers = {
    "cookie": "HMACCOUNT_BFESS=6BF4131F2D346AC8; BAIDUID_BFESS=074D05A61BAC10713B08151BCBB5E7C8:FG=1; ZFY=HMyObm7phQtwOkcgQWY6OBQYsx:ABX8bf0vbEsOUTHUY:C; BDUSS_BFESS=xzbVJzRHFEQ0dpNkExdDg1YTJxOG5hTzdJZUVQelN4TGZWYS14ZkV2c2RXd3RvSVFBQUFBJCQAAAAAAAAAAAEAAABdYPAlbGlmZcix0ru33bCytqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3O42cdzuNnRG",
    "host": "hm.baidu.com",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
}

async function getHtml(config) {
  try {
    return await axios.request(typeof config === "string" ? config : {
      url: config.url,
      method: config.method || 'GET',
      headers: {
        ...headers,
        ...config.headers
      },
      data: config.data || '',
      responseType: config.responseType || '',
    })
  } catch (e) {
    return e.response
  }
}

const pq = (html) => {
  const jsp = new jsoup();
  return jsp.pq(html);
}

const classes = [
  {type_id: 'mv', type_name: '电影'},
  {type_id: 'tv', type_name: '剧集'},
  {type_id: 'ac', type_name: '动漫'}
]

const tags = classes.map(item => item.type_name)

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

  const categoryUrl = `${url}${tid}?page=${page}`;
  const { data } = await req.get(categoryUrl, {
    headers: headers,
  });

  const $ = pq(data);
  
  const scriptContent = $('script').filter((_, script) => {
    return $(script).html().includes('_obj.header');
  }).html();

  const jsonStart = scriptContent.indexOf('{');
  const jsonEnd = scriptContent.lastIndexOf('}') + 1;
  const jsonString = scriptContent.slice(jsonStart, jsonEnd);

  const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
  let videos = [];

  if (inlistMatch) {
    const inlistData = JSON.parse(inlistMatch[1]);
    
    inlistData["i"].forEach((item, index) => {
      videos.push({
        vod_name: inlistData["t"][index],
        vod_id: item,
        vod_pic: `https://s.tutu.pm/img/${inlistData["ty"]}/${item}.webp`,
        vod_remarks: inlistData["g"][index],
      });
    });
  }

  return ({
    page: parseInt(page),
    pagecount: 10, 
    limit: videos.length,
    total: videos.length,
    list: videos,
  });
}

async function detail(inReq, _outResp) {
  const detailUrl = `${url}res/downurl/${inReq.body.id}`;
  const { data } = await req.get(detailUrl, {
    headers: headers,
  });

  const respstr = JSON.parse(data);
  let vod = {
    vod_name: respstr.playlist ? respstr.playlist[0]?.t : 'Unknown',
    vod_id: inReq.body.id,
  };

  if (respstr.hasOwnProperty('playlist')) {
    const froms = respstr.playlist.map(pl => pl.t || '').join('$$$');
    const urls = respstr.playlist.map(pl => 
      pl.list.map((line, i) => `${line}$${url}py/${pl.i}/${i+1}`).join('#')
    ).join('$$$');

    vod.vod_play_from = froms;
    vod.vod_play_url = urls;
  }

  return {
    list: [vod],
  };
}

async function search(inReq, _outResp) {
  const pg = inReq.body.page || 1;
  const wd = inReq.body.wd;
  const searchUrl = `${url}/s/1---${pg}/${encodeURIComponent(wd)}`;

  const { data } = await req.get(searchUrl, {
    headers: headers,
  });

  const $ = pq(data);
  let videos = [];

  $('.v5d').each((index, element) => {
    const name = $(element).find('b').text().trim() || 'N/A';
    const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 'N/A';
    const additionalInfo = $(element).find('p').text().trim() || 'N/A';
    const pathMatch = $(element).find('a').attr('href') || 'N/A';

    videos.push({
      vod_name: name,
      vod_id: pathMatch,
      vod_remarks: additionalInfo,
      vod_pic: imgUrl,
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
