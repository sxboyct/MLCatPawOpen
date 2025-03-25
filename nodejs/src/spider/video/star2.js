import req from '../../util/req.js';
import {init, proxy, play, detail as _detail} from '../../util/pan.js';
import {jsoup} from "../../util/htmlParser.js";
import axios from "axios";
import {PC_UA} from "../../util/misc.js";

const appConfig = {
	ver: 1,
	title: 'star2',
	site: 'https://1.star2.cn',
	tabs: [
		{
			name: '電影',
			ext: {
				id: 'mv',
			},
		},
		{
			name: '国劇',
			ext: {
				id: 'ju',
			},
		},
		{
			name: '外劇',
			ext: {
				id: 'wj',
			},
		},
		{
			name: '韩日',
			ext: {
				id: 'rh',
			},
		},
		{
			name: '英美',
			ext: {
				id: 'ym',
			},
		},
		{
			name: '短劇',
			ext: {
				id: 'dj',
			},
		},
		{
			name: '動漫',
			ext: {
				id: 'dm',
			},
		},
		{
			name: '綜藝',
			ext: {
				id: 'zy',
			},
		},
	],
}

async function home(_inReq, _outResp) {
    let classes = appConfig.tabs.map(tab => ({
        type_id: tab.ext.id,
        type_name: tab.name
    }));
    
    let filterObj = {};
    return ({
        class: classes,
        filters: filterObj,
    });
}

async function category(inReq, _outResp) {
    const pg = inReq.body.page || 1;
    const id = inReq.body.tid;

    const url = appConfig.site + `/${id}_${pg}`
    const { data } = await req.get(url, {
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
    };

    return {
        list: [vod],
    };
}

async function search(inReq, _outResp) {
    const pg = inReq.body.page || 1;
    const wd = inReq.body.wd;
    
    let text = encodeURIComponent(wd);
    let url = `${appConfig.site}/search/?keyword=${text}&page=${pg}`

    const { data } = await req.get(url, {
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
        key: 'star2',
        name: '星剧社',
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
