import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const appConfig = {
	ver: 1,
	title: 'SeedHub',
	site: 'https://www.seedhub.cc',
	tabs: [
		{
			name: '首页',
			ext: {
				id: '/',
			},
		},
		{
			name: '电影',
			ext: {
				id: '/categories/1/movies/',
			},
		},
		{
			name: '剧集',
			ext: {
				id: '/categories/3/movies/',
			},
		},
		{
			name: '动漫',
			ext: {
				id: '/categories/2/movies/',
			},
		}
	],
}

async function home(_inReq, _outResp) {
    let classes = appConfig.tabs.map(tab => ({
        type_id: tab.ext.id,
        type_name: tab.name
    }));

    const url = appConfig.site; // 访问首页
    const { data } = await req.get(url, {
        headers: {
            'User-Agent': PC_UA,
        },
    });

    const $ = new jsoup().pq(data);
    const videos = $('.cover');
    const cards = [];

    videos.each((_, e) => {
        const href = $(e).find('a').attr('href');
        const title = $(e).find('a img').attr('alt');
        const cover = $(e).find('a img').attr('src');

        cards.push({
            vod_id: href,
            vod_name: title,
            vod_pic: cover,
            vod_remarks: '',
            ext: {
                url: `${appConfig.site}${href}`,
            },
        });
    });

    return {
        class: classes,  // 仍然返回分类信息
        filters: {},      // 保持筛选器为空
        list: cards,      // 添加首页影片列表
    };
}

async function category(inReq, _outResp) {
    const pg = inReq.body.page || 1;
    const id = inReq.body.tid;

    const url = appConfig.site + id + `?page=${pg}`;
    const { data } = await req.get(url, {
        headers: {
            'User-Agent': PC_UA,
        },
    });

    const $ = new jsoup().pq(data);
    const videos = $('.cover');
    const cards = [];

    videos.each((_, e) => {
        const href = $(e).find('a').attr('href');
        const title = $(e).find('a img').attr('alt');
        const cover = $(e).find('a img').attr('src');
        
        cards.push({
            vod_id: href,
            vod_name: title,
            vod_pic: cover,
            vod_remarks: '',
            ext: {
                url: `${appConfig.site}${href}`,
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
    const url = `${appConfig.site}${inReq.body.id}`;
    const { data } = await req.get(url, {
        headers: {
            'User-Agent': PC_UA,
        },
    });

    const $ = new jsoup().pq(data);
    
    // 创建并初始化vod对象 - 添加基本信息
    const vod = {
        vod_id: inReq.body.id,
        vod_name: $('.movie-info h1').text() || $('h1.title').text() || '',
        vod_pic: $('.movie-poster img').attr('src') || $('.poster img').attr('src') || '',
        vod_content: $('.movie-description').text() || $('.description').text() || '',
        // 初始化其他可能的元数据
        vod_year: $('.movie-info .year').text() || '',
        vod_area: $('.movie-info .area').text() || '',
        vod_director: $('.movie-info .director').text() || '',
        vod_actor: $('.movie-info .actor').text() || ''
    };

    // 收集所有网盘分享链接
    const playlist = $('.pan-links');
    const shareUrls = [];

    playlist.each((_, e) => {
        $(e).find('li a').each((_, link) => {
            const panShareUrl = $(link).attr('data-link');
            if (panShareUrl) {
                shareUrls.push(panShareUrl);
            }
        });
    });

    // 如果找不到通过data-link属性的链接，尝试其他可能的选择器或属性
    if (shareUrls.length === 0) {
        $('.download-links a, .pan-links a').each((_, link) => {
            const panShareUrl = $(link).attr('href') || $(link).attr('data-url');
            if (panShareUrl && panShareUrl.includes('pan')) {
                shareUrls.push(panShareUrl);
            }
        });
    }

    // 使用 _detail 处理网盘链接
    if (shareUrls.length > 0) {
        const vodFromUrl = await _detail(shareUrls);
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
    
    let text = encodeURIComponent(wd);
    let url = `${appConfig.site}/s/${text}/?page=${pg}`;

    const { data } = await req.get(url, {
        headers: {
            'User-Agent': PC_UA,
        },
    });

    const $ = new jsoup().pq(data);
    const videos = $('.cover');
    const cards = [];

    videos.each((_, e) => {
        const href = $(e).find('a').attr('href');
        const title = $(e).find('a img').attr('alt');
        const cover = $(e).find('a img').attr('src');
        
        cards.push({
            vod_id: href,
            vod_name: title,
            vod_pic: cover,
            vod_remarks: '',
            ext: {
                url: `${appConfig.site}${href}`,
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
        key: 'seedhub',
        name: 'SeedHub资源',
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
