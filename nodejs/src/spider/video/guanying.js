import axios from "axios";
import req from "../../util/req.js";
import { jsoup } from "../../util/htmlParser.js";
import { PC_UA } from "../../util/misc.js";

const appConfig = {
  site: 'https://www.gyg.la/',
  tabs: [
    { type_id: 'mv', type_name: '电影' },
    { type_id: 'tv', type_name: '剧集' },
    { type_id: 'ac', type_name: '动漫' }
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
async function category(typeId, page = 1) {
  const url = `${appConfig.site}${typeId}${page}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        Cookie: persistentCookie, // 自动携带持久化的Cookie
        Referer: appConfig.site,
        "User-Agent": PC_UA
      }
    });
    
    console.log("分类数据:", response.data);
    return response.data;
  } catch (error) {
    console.error("获取分类数据失败:", error);
    
    // 如果出现游客验证问题，重新登录并重试请求
    if (error.response && error.response.status === 302) {
      console.log("检测到游客验证，重新登录...");
      await login();
      return category(typeId, page); // 重试请求
    }
  }
}

// 初始化并测试
(async function init() {
  await login(); // 登录并保存Cookie
  const data = await category('mv?page=', 1); // 测试访问分类页面
  console.log(data);
})();
