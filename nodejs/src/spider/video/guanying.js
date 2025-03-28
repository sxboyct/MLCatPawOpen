import req from '../../util/req.js';
import { jsoup } from "../../util/htmlParser.js";
import axios from "axios";
import { PC_UA } from "../../util/misc.js";

const appConfig = {
  site: 'https://www.gyg.la/',
  tabs: [
    { type_id: 'mv?page=', type_name: '电影' },
    { type_id: 'tv?page=', type_name: '剧集' },
    { type_id: 'ac?page=', type_name: '动漫' }
  ]
};

let persistentCookie = ""; // 持久化保存Cookie

// 登录函数
async function login() {
  const loginUrl = 'https://www.gyg.la/user/login';
  const payload = {
    code: '',
    siteid: 1,
    dosubmit: 1,
    cookietime: 10506240, // 设置长时间有效的Cookie
    username: 'sxboyc',
    password: 'NP8Gpx0jPU1b0j'
  };

  try {
    const response = await axios.post(loginUrl, payload);
    const cookies = response.headers['set-cookie'];
    persistentCookie = cookies.join('; '); // 保存Cookie用于后续请求
    console.log("登录成功，Cookie已保存");
  } catch (error) {
    console.error("登录失败:", error);
  }
}

// 获取分类数据
async function category(inReq, _outResp) {
  const tid = inReq.body.id;
  const pg = inReq.body.page || 1;
  const url = `${appConfig.site}${tid}${pg}`;

  try {
    const { data } = await req.get(url, {
      headers: {
        Cookie: persistentCookie, // 自动携带持久化的Cookie
        Referer: appConfig.site,
        "User-Agent": PC_UA
      }
    });

    const $ = new jsoup().pq(data);
    const scriptContent = $('script').filter((_, script) =>
      $(script).html().includes('_obj.header')
    ).html();

    const jsonStart = scriptContent.indexOf('{');
    const jsonEnd = scriptContent.lastIndexOf('}') + 1;
    const jsonString = scriptContent.slice(jsonStart, jsonEnd);

    const inlistMatch = jsonString.match(/_obj\.inlist=({.*});/);
    if (!inlistMatch) throw new Error("未找到 _obj.inlist 数据");
    
    const inlistData = JSON.parse(inlistMatch[1]);
    const videos = inlistData.i.map((item, index) => ({
      vod_name: inlistData.t[index],
      vod_id: `${inlistData.ty}/${item}`,
      vod_pic: `https://s.tutu.pm/img/${inlistData.ty}/${item}.webp`,
      vod_remarks: inlistData.g[index]
    }));

    return {
      page: pg,
      pagecount: 999,
      limit: 20,
      total: 999,
      list: videos
    };
  } catch (error) {
    console.error("获取分类数据失败:", error);

    // 如果出现游客验证问题，重新登录并重试请求
    if (error.response && error.response.status === 302) {
      console.log("检测到游客验证，重新登录...");
      await login();
      return category(inReq, _outResp); // 重试请求
    }
  }
}

// 获取详情数据
async function detail(inReq, _outResp) {
  const [ty, id] = inReq.body.id.split('/');
  const url = `${appConfig.site}res/downurl/${ty}/${id}`;

  try {
    const { data } = await req.get(url, {
      headers: {
        Cookie: persistentCookie,
        Origin: appConfig.site,
        "User-Agent": PC_UA
      }
    });

    const resp = JSON.parse(data);
    const vodPlayFrom = [];
    
    if (resp.playlist) {
      vodPlayFrom.push(
        resp.playlist.map(p =>
          p.list.map((_, i) => `${appConfig.site}py/${p.i}/${i + 1}`).join('#')
        ).join('$$$')
      );
    }

    if (resp.panlist) {
      vodPlayFrom.push(resp.panlist.url.join('#'));
    }

    return { list: [{ vod_play_from: vodPlayFrom.join('$$$') }] };
  } catch (error) {
    console.error("获取详情数据失败:", error);
  }
}

// 搜索功能
async function search(inReq, _outResp) {
  const wd = encodeURIComponent(inReq.body.wd);
  const pg = inReq.body.page || 1;
  const url = `${appConfig.site}/s/1---${pg}/${wd}`;

  try {
    const { data } = await req.get(url, {
      headers: {
        Cookie: persistentCookie,
        Referer: `${appConfig.site}/search/`,
        "User-Agent": PC_UA
      }
    });

    const $ = new jsoup().pq(data);
    const videos = [];

    $('.v5d').each((index, element) => {
      videos.push({
        vod_name: $(element).find('b').text(),
        vod_id: $(element).find('a').attr('href'),
        vod_pic: $(element).find('source').attr('data-srcset'),
        vod_remarks: $(element).find('p').text()
      });
    });

    return {
      page: pg,
      pagecount: 1,
      list: videos
    };
  } catch (error) {
    console.error("搜索失败:", error);
  }
}

// 初始化API接口
export default {
  meta: {
    key: 'guanying',
    name: '观影网',
    type: 3
  },
  
  api: async (fastify) => {
    
    fastify.post('/init', async () => await login()); // 初始化时登录并保存Cookie
    
    fastify.post('/home', async (_inReq, _outResp) => ({
      class: appConfig.tabs.map(tab => ({
        type_id: tab.type_id,
        type_name: tab.type_name
      })),
      filters: {}
    }));
    
    fastify.post('/category', category);
    
    fastify.post('/detail', detail);
    
    fastify.post('/search', search);
    
  }
};
