import axios from "axios";
import { jsoup } from "../../util/htmlParser.js";
import { PC_UA } from "../../util/misc.js";

const appConfig = {
  ver: 1,
  title: '观影网',
  site: 'https://www.gyg.la',
  tabs: [
    { name: '电影', ext: { id: '/mv' } },
    { name: '剧集', ext: { id: '/tv' } },
    { name: '动漫', ext: { id: '/ac' } },
  ],
};

const headers = {
  "cookie": "HMACCOUNT_BFESS=6BF4131F2D346AC8; BAIDUID_BFESS=074D05A61BAC10713B08151BCBB5E7C8:FG=1; ZFY=HMyObm7phQtwOkcgQWY6OBQYsx:ABX8bf0vbEsOUTHUY:C; BDUSS_BFESS=xzbVJzRHFEQ0dpNkExdDg1YTJxOG5hTzdJZUVQelN4TGZWYS14ZkV2c2RXd3RvSVFBQUFBJCQAAAAAAAAAAAEAAABdYPAlbGlmZcix0ru33bCytqgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB3O42cdzuNnRG",
  "host": "hm.baidu.com",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
};

async function getHtml(config) {
  try {
    return await axios.request(typeof config === "string" ? config : {
      url: config.url,
      method: config.method || 'GET',
      headers: {
        ...headers,
        ...(config.headers || {}),
      },
      data: config.data || '',
      responseType: config.responseType || '',
    });
  } catch (e) {
    return e.response;
  }
}

async function _detail(url) {
  const { data } = await getHtml({
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    },
  });
  const $ = jsoup(data);

  let froms = [];
  let urls = [];

  // 根据实际网页结构修改以下部分
  const link = $('a').attr('href');
  if (link) {
    urls.push(link);
    froms.push('网盘');
  }

  return { froms, urls };
}

async function getTracks(ext) {
  ext = argsify(ext);
  let tracks = [];
  let url = ext.url;

  const { data } = await getHtml({
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    },
  });

  const respstr = JSON.parse(data);

  if (respstr.hasOwnProperty('panlist')) {
    respstr.panlist.url.forEach((item, index) => {
      tracks.push({
        name: '网盘',
        pan: item,
        ext: {
          url: '',
        },
      });
    });
  } else if (respstr.hasOwnProperty('file')) {
    console.error('网盘验证掉签');
  } else {
    console.error('没有网盘资源');
  }

  return {
    list: [
      {
        title: '默认分组',
        tracks,
      },
    ],
  };
}

async function home(_inReq, _outResp) {
  let filterObj = {};
  return {
    class: appConfig.tabs.map(item => ({ type_name: item.name })),
    filters: filterObj,
  };
}

async function category(inReq, _outResp) {
  const tid = inReq.body.id;
  const pg = inReq.body.page;
  let page = pg || 1;
  if (page == 0) page = 1;

  let url = `${appConfig.site}${appConfig.tabs.find(tab => tab.name === tid).ext.id}${page}`;
  const { data } = await getHtml({
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    },
  });

  const $ = jsoup(data);
  let videos = [];

  // 根据实际网页结构修改以下部分
  $('.v5d').each((index, element) => {
    const name = $(element).find('b').text().trim() || 'N/A';
    const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 'N/A';
    const additionalInfo = $(element).find('p').text().trim() || 'N/A';
    const pathMatch = $(element).find('a').attr('href') || 'N/A';

    videos.push({
      "vod_name": name,
      "vod_id": pathMatch,
      "vod_pic": imgUrl,
      "vod_remarks": additionalInfo,
    });
  });

  return {
    page: parseInt(page),
    pagecount: 1,
    limit: videos.length,
    total: videos.length,
    list: videos,
  };
}

async function detail(inReq, _outResp) {
  let html = await getHtml({
    url: `${appConfig.site}${inReq.body.id}`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    },
  });
  const $ = jsoup(html);

  let vod = {
    "vod_name": $('.title')[0].children[0].data.trim(),
    "vod_id": `/${inReq.body.id}`,
    "vod_content": $('div.topicContent p:nth-child(1)').text().replace(/\s+/g, ''),
  };

  // 根据实际网页结构修改以下部分
  let content_html = $('.topicContent').html();
  let link = content_html.match(/]*?\s+)?href=["'](https:\/\/caiyun\.139\.com\/[^"']*)["'][^>]*>/gi);

  if (!link || link.length === 0) {
    link = content_html.match(/https:\/\/caiyun\.139\.com\/[^<]*/)[0];
  } else {
    link = link[0].match(/https:\/\/caiyun\.139\.com\/[^"']*/)[0];
  }

  const vodFromUrl = await _detail(link);
  if (vodFromUrl) {
    vod.vod_play_from = vodFromUrl.froms;
    vod.vod_play_url = vodFromUrl.urls;
  }

  return {
    list: [vod],
  };
}

async function search(inReq, _outResp) {
  const pg = inReq.body.page || 1;
  const wd = inReq.body.wd;
  let text = encodeURIComponent(wd);
  let url = `${appConfig.site}/s/1---${pg}/${text}`;

  const { data } = await getHtml({
    url: url,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    },
  });

  const $ = jsoup(data);
  let videos = [];

  $('.v5d').each((index, element) => {
    const name = $(element).find('b').text().trim() || 'N/A';
    const imgUrl = $(element).find('picture source[data-srcset]').attr('data-srcset') || 'N/A';
    const additionalInfo = $(element).find('p').text().trim() || 'N/A';
    const pathMatch = $(element).find('a').attr('href') || 'N/A';

    videos.push({
      "vod_name": name,
      "vod_id": pathMatch,
      "vod_pic": imgUrl,
      "vod_remarks": additionalInfo,
    });
  });

  return {
    page: pg,
    pagecount: 1,
    list: videos,
  };
}

async function play(inReq, _outResp) {
  const vodFromUrl = await _detail(inReq.body.url);
  if (vodFromUrl) {
    return {
      froms: vodFromUrl.froms,
      urls: vodFromUrl.urls,
    };
  } else {
    return { froms: [], urls: [] };
  }
}

export default {
  meta: {
    key: 'guanying',
    name: '观影网',
    type: 3,
  },
  api: async (fastify) => {
    fastify.post('/init', async () => {
      return { message: 'initialized' };
    });
    fastify.post('/home', home);
    fastify.post('/category', category);
    fastify.post('/detail', detail);
    fastify.post('/play', play);
    fastify.post('/search', search);
    fastify.post('/tracks', getTracks);
  },
};
