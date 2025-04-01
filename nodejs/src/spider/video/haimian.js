import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import {Cloud} from "../../util/cloud.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";
import {getCache} from "../../website/haimian.js";

async function getHtml(config) {
  try {
    return await axios.request(typeof config === "string" ? config : {
      url: config.url,
      method: config.method || 'GET',
      headers: config.headers || {
        'User-Agent': PC_UA
      },
      data: config.data || '',
      responseType: config.responseType || '',//'arraybuffer'
    })
  } catch (e) {
    return e.response
  }
}

async function request(reqUrl) {
  const resp = await req.get(reqUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
    },
  });
  return resp.data;
}

const pq = (html) => {
  const jsp = new jsoup();
  return jsp.pq(html);
}

async function home(_inReq, _outResp) {
  let classes = [
    {type_id: '42204681950354', type_name: '电影',},
    {type_id: '42204684250355', type_name: '剧集',},
    {type_id: '42212287587456', type_name: '影视原盘',},
    {type_id: '42204697150356', type_name: '记录',},
    {type_id: '42204792950357', type_name: '动画动漫',},
    {type_id: '42210356650363', type_name: " 综艺"}
  ];
  let filterObj = {};
  return ({
    class: classes,
    filters: filterObj,
  });
}

async function category(inReq, _outResp) {
  const url = await getCache(inReq.server)
  const tid = inReq.body.id;
  const pg = inReq.body.page;
  let page = pg || 1;
  if (page == 0) page = 1;
  let html = await request(`${url}/?tagId=${tid}&page=${page}`)
  const $ = pq(html)
  let videos = []
  $('.topicList .topicItem').each((index, item) => {
    const a = $(item).find('h2 a:first')[0];
    videos.push({
      "vod_name": a.children[0].data,
      "vod_id": a.attribs.href,
      "vod_pic": `${url}/favicon.ico`
    })
  })
  const pageInfo = $('.topicPage .pg')[0]
  const total = $(pageInfo).find('.count')[0].children[0].data.match(/\d+/)[0]
  const pageCount = $(pageInfo).find('.last')[0].attribs.title.match(/\d+/)[0]
  return ({
    page: parseInt(page),
    pagecount: pageCount ? parseInt(pageCount) : 1,
    limit: videos.length,
    total: total ? parseInt(total) : videos.length,
    list: videos,
  });
}

async function detail(inReq, _outResp) {
  const url = await getCache(inReq.server)
  let html = await request(`${url}/${inReq.body.id}`)
  const $ = pq(html)
  let vod = {
    "vod_name": $('.movie-info a').attr('data-caption'),
    "vod_id": `/${inReq.body.id}`,
  }
  let content_html = $('.message.break-all').html()
  let linkMatch = content_html.match(/<a\s+(?:[^>]*?\s+)?href=["']([^"']*cloud\.189\.cn[^"']*)["'][^>]*>/i);
let link = null;

if (linkMatch) {
    // 处理 outlink-https_3A_2F_2F 这种编码格式
    link = linkMatch[1].replace(/outlink-https_3A_2F_2F/g, 'https://')
                        .replace(/_2F/g, '/')
                        .replace(/_2E/g, '.');
} else {
    // 如果 <a> 没有匹配到，则匹配 <span> 里面的链接
    let spanMatch = content_html.match(/<span\s+style="color:\s*#0070C0;\s*">(https?:\/\/cloud\.189\.cn\/[^<]*)<\/span>/i);
    if (spanMatch) {
        link = spanMatch[1];
    }
}

// 备用匹配，防止 span 也没匹配到
  if (!link) {
    let directMatch = content_html.match(/https?:\/\/cloud\.189\.cn\/[^<]*/);
    link = directMatch ? directMatch[0] : null;
 }
  if (/cloud.189.cn/.test(link)) {
    const vodFromUrl = await _detail(link);
    if (vodFromUrl){
      vod.vod_play_from = vodFromUrl.froms;
      vod.vod_play_url = vodFromUrl.urls;
    }
  }
  return {
    list: [vod],
  };
}


async function search(inReq, _outResp) {
  const url = await getCache(inReq.server)
  const pg = inReq.body.page || 1;
  const wd = inReq.body.wd;
  let html = (await getHtml(`${url}/search.htm?keyword=${encodeURIComponent(decodeURIComponent(wd))}&page=${pg}`)).data
  const $ = pq(html)
  let videos = []
  $('.list-unstyled.threadlist.mb-0 .media.thread.tap').each((index, item) => {
  const a = $(item).find('.subject a:first')[0];
  videos.push({
    "vod_name": $(a).html().replace(/<[^>]*>/g, '').replace(/\s+/g, ''),
    "vod_id": a.attribs.href,
     "vod_remarks": '',
     "vod_pic": `${url}/favicon.ico`
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
    key: 'haimian',
    name: '海绵',
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
