import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

export const runtime = 'nodejs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'vicortavares824';
const GITHUB_REPO = process.env.GITHUB_REPO || 'teste-de-api';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

const FILE_MAP = {
  filmes: 'filmes.json',
  series: 'series.json',
  animes: 'animes.json',
};

export async function POST(request: NextRequest) {
  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN não configurado no arquivo .env.local' },
      { status: 500 }
    );
  }

  try {
    const { type, data } = await request.json();

    if (!type || !['filmes', 'series', 'animes'].includes(type)) {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }

    const fileName = FILE_MAP[type as keyof typeof FILE_MAP];
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // 1. Buscar o arquivo atual
    const { data: fileData } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: fileName,
    });

    if (!('content' in fileData)) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 });
    }

    // 2. Decodificar e parsear
    const content = Buffer.from(fileData.content, 'base64').toString();
    const json = JSON.parse(content);

    // 3. Preparar o novo item
    const newItem: any = {
      adult: false,
      backdrop_path: data.backdrop_path || '',
      backdrop_url: data.backdrop_path
        ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`
        : '',
      genre_ids: data.genre_ids
        ? data.genre_ids.split(',').map((id: string) => parseInt(id.trim()))
        : [],
      id: parseInt(data.id),
      original_language: data.original_language || 'pt',
      overview: data.overview,
      popularity: parseFloat(data.popularity) || 0,
      poster_path: data.poster_path || '',
      poster_url: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : '',
      vote_average: parseFloat(data.vote_average) || 0,
      vote_count: parseInt(data.vote_count) || 0,
    };

    // Adicionar campos específicos por tipo
    if (type === 'filmes') {
      newItem.original_title = data.original_title || data.title;
      newItem.release_date = data.release_date || '';
      newItem.title = data.title;
      newItem.video = data.video || '';
      newItem.URLvideo = data.video || '';
    } else {
      // Séries e Animes
      newItem.original_name = data.original_name || data.name;
      newItem.first_air_date = data.first_air_date || '';
      newItem.name = data.name;
      newItem.video = null;

      // Adicionar temporadas
      if (data.temporadas && Object.keys(data.temporadas).length > 0) {
        Object.assign(newItem, data.temporadas);
      }
    }

    // 4. Verificar se já existe (por TMDB ID)
    if (!json.pages || !json.pages[0] || !json.pages[0].results) {
      return NextResponse.json(
        { error: 'Estrutura de JSON inválida' },
        { status: 400 }
      );
    }

    // Verificar duplicatas em todas as páginas
    const exists = json.pages.some((page: any) =>
      page.results.some((item: any) => item.id === newItem.id)
    );

    if (exists) {
      const itemName = type === 'filmes' ? data.title : data.name;
      return NextResponse.json(
        {
          error: 'Duplicata',
          message: `${type === 'filmes' ? 'Filme' : type === 'series' ? 'Série' : 'Anime'} "${itemName}" já existe no banco de dados!`,
          tmdb_id: newItem.id,
        },
        { status: 409 } // 409 Conflict
      );
    }

    json.pages[0].results.unshift(newItem); // Adiciona no início

    // 5. Fazer commit
    const commitMessage =
      type === 'filmes'
        ? `Adicionar filme: ${data.title}`
        : `Adicionar ${type === 'series' ? 'série' : 'anime'}: ${data.name}`;

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: fileName,
      message: commitMessage,
      content: Buffer.from(JSON.stringify(json, null, 2)).toString('base64'),
      sha: fileData.sha,
    });

    return NextResponse.json({
      success: true,
      message: `${type === 'filmes' ? 'Filme' : type === 'series' ? 'Série' : 'Anime'} adicionado com sucesso!`,
      item: newItem,
    });
  } catch (error: any) {
    console.error('Erro ao adicionar mídia:', error);
    return NextResponse.json(
      { error: error.message || 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
