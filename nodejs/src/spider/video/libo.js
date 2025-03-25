import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import {PC_UA} from "../../util/misc.js";

async function getHtml(config) {
  try {
    const resp = await req.get(config, {
      headers: {
        'User-Agent': PC_UA,
        'Referer': 'https://www.libvio.cc/',
        'Origin': 'https://www.libvio.cc'
      }
    });
    return resp;
  } catch (e) {
    return e.response;
  }
}

async function request(reqUrl) {
  const resp = await req.get(reqUrl, {
    headers: {
      'User-Agent': PC_UA,
      'Referer': 'https://www.libvio.cc/',
      'Origin': 'https://www.libvio.cc'
    },
  });
  return resp;
}

const pq = (html) => {
  const jsp = new jsoup();
  return jsp.pq(html);
}

async function home(_inReq, _outResp) {
  let classes = [
    {type_id: '1', type_name: '电影'},
    {type_id: '2', type_name: '剧集'},
    {type_id: '4', type_name: '动漫'},
    {type_id: '15', type_name: '日韩剧'},
    {type_id: '16', type_name: '欧美剧'}
  ];
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

  const url = `https://www.libvio.cc/type/${tid}-${page}.html`;
  let html = await request(url);
  const $ = pq(html);
  
  let videos = [];
  $('a.stui-vodlist__thumb').each((index, item) => {
    const a = $(item);
    videos.push({
      "vod_name": a.attr('title'),
      "vod_id": a.attr('href'),
      "vod_pic": a.attr('data-original'),
      "vod_remarks": a.find('.text-right').text()
    });
  });

  const pageInfo = $('.stui-page .total').text().match(/\d+/g);
  const total = pageInfo ? parseInt(pageInfo[0]) : videos.length;
  const pagecount = pageInfo ? Math.ceil(total / 20) : 1;

  return ({
    page: parseInt(page),
    pagecount: pagecount,
    limit: videos.length,
    total: total,
    list: videos,
  });
}

async function detail(inReq, _outResp) {
  const url = `https://www.libvio.cc${inReq.body.id}`;
  let html = await request(url);
  const $ = pq(html);
  
  let vod = {
    "vod_name": $('.stui-content__detail h1').text().trim(),
    "vod_id": inReq.body.id,
    "vod_content": $('.stui-content__detail .desc').text().trim(),
  }

  let playInfo = html.match(/var player_.*?=(.*?)</);
  if (playInfo && playInfo[1]) {
    let playerData = JSON.parse(playInfo[1]);
    let playUrl = playerData.url;
    
    const trackList = [];
    $('.stui-vodlist__head').each((_, head) => {
      let title = $(head).find('.stui-pannel__head').text().trim();
      if (!title.includes('下载')) {
        $(head).find('.stui-content__playlist li').each((_, li) => {
          trackList.push(`${$(li).text()}$${$(li).find('a').attr('href')}`);
        });
      }
    });

    vod.vod_play_from = '线路';
    vod.vod_play_url = trackList.join('#');
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

  const url = `https://www.libvio.cc/search/-------------.html?wd=${encodeURIComponent(wd)}&submit=`;
  let html = await request(url);
  const $ = pq(html);
  
  let videos = [];
  $('a.stui-vodlist__thumb').each((_, each) => {
    videos.push({
      "vod_name": $(each).attr('title'),
      "vod_id": $(each).attr('href'),
      "vod_remarks": $(each).find('.text-right').text(),
      "vod_pic": $(each).attr('data-original')
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
    key: 'libvio',
    name: '立播',
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