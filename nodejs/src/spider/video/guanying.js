import req from '../../util/req.js';
import axios from "axios";
import {jsoup} from "../../util/htmlParser.js";
import {PC_UA} from "../../util/misc.js";

const appConfig = {
  site: 'https://www.gyg.la/',
  tabs: [
    {type_id: 'mv?page=', type_name: '电影'},
    {type_id: 'tv?page=', type_name: '剧集'},
    {type_id: 'ac?page=', type_name: '动漫'}
  ]
};

const CUSTOM_HEADERS = {
  "host": "hm.baidu.com",
  "user-agent": PC_UA
};

const loginUrl = 'https://www.gyg.la/user/login';
const payload = {
  code: '',
  siteid: 1,
  dosubmit: 1,
  cookietime: 10506240,
  username: 'sxboyc',
  password: 'NP8Gpx0jPU1b0j'
};

async function login() {
  try {
    const response = await axios.post(loginUrl, payload);
    const cookies = response.headers['set-cookie'];
    const cookie = cookies.join('; ');
    return cookie;
  } catch (error) {
    console.error(error);
  }
}

// 获取Cookie后更新CUSTOM_HEADERS
login().then(cookie => {
  CUSTOM_HEADERS.cookie = cookie;
});

const pq = (html) => {
  const jsp = new jsoup();
  return jsp.pq(html);
};

async function home(_inReq, _outResp) {
  return {
    class: appConfig.tabs.map(tab => ({
      type_id: tab.ext.id,
      type_name: tab.name
    })),
    filters: {}
  };
}

async function category(inReq, _outResp) {
  const tid = inReq.body.id;
  const pg = inReq.body.page || 1;
  const url = `${appConfig.site}${tid}${pg}`;

  const {data} = await req.get(url, {
    headers: {
      ...CUSTOM_HEADERS,
      Referer: appConfig.site
    }
  });

  const $ = pq(data);
  const scriptContent = $('script').filter((_, script) =>
    $(script).html().includes('_obj.header')
  ).html();

  const jsonStart = scriptContent.indexOf('{');
  const jsonEnd = scriptContent.lastIndexOf('}') + 1;
  const jsonString = scriptContent.slice(jsonStart, jsonEnd);

  const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
  if (!inlistMatch) throw new Error("未找到 _obj.inlist 数据");
  const inlistData = JSON.parse(inlistMatch[1]);

  const videos = [];
  inlistData.i.forEach((item, index) => {
    videos.push({
      vod_name: inlistData.t[index],
      vod_id: `${inlistData.ty}/${item}`,
      vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
      vod_remarks: inlistData.g[index]
    });
  });

  return {
    page: pg,
    pagecount: 999,
    limit: 20,
    total: 999,
    list: videos
  };
}

async function detail(inReq, _outResp) {
  const [ty, id] = inReq.body.id.split('/');
  const url = `${appConfig.site}res/downurl/${ty}/${id}`;

  const {data} = await req.get(url, {
    headers: {
      ...CUSTOM_HEADERS,
      Origin: appConfig.site
    }
  });

  const resp = JSON.parse(data);
  const vod = {
    vod_name: '',
    vod_play_from: '在线播放$$$网盘播放',
    vod_play_url: []
  };

  if (resp.playlist) {
    const onlineUrls = resp.playlist.map(p =>
      p.list.map((_, i) => `${appConfig.site}py/${p.i}/${i + 1}`).join('#')
    ).join('$$$');
    vod.vod_play_url.push(onlineUrls);
  }

  if (resp.panlist) {
    const panUrls = resp.panlist.url.join('#');
    vod.vod_play_url.push(panUrls);
  }

  return {list: [vod]};
}

async function search(inReq, _outResp) {
  const wd = encodeURIComponent(inReq.body.wd);
  const pg = inReq.body.page || 1;
  const url = `${appConfig.site}/s/1---${pg}/${wd}`;

  const {data} = await req.get(url, {
    headers: {
      ...CUSTOM_HEADERS,
      Referer: `${appConfig.site}/search/`
    }
  });

  const $ = pq(data);
  const videos = [];

  $('.v5d').each((index, element) => {
    const a = $(element).find('a');
    videos.push({
      vod_name: $(element).find('b').text(),
      vod_id: a.attr('href'),
      vod_pic: $(element).find('source').attr('data-srcset'),
      vod_remarks: $(element).find('p').text()
    });
  });

  return {
    page: pg,
    pagecount: 1,
    list: videos
  };
}

export default {
  meta: {
    key: 'guanying',
    name: '观影网',
    type: 3
  },
  api: async (fastify) => {
    fastify.post('/init', async () => {
      // 初始化时获取Cookie
      const cookie = await login();
      CUSTOM_HEADERS.cookie = cookie;
    });

    fastify.post('/home', home);
    fastify.post('/category', category);
    fastify.post('/detail', detail);
    fastify.post('/search', search);
  }
};
