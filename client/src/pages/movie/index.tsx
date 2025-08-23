import { memo } from 'react';
import { useMovie } from './services/useMovie';
import MovieView from '../../shared/components/movie-view/MovieView';

const Movie = () => {
  const {getMovies} = useMovie()
  const {data} = getMovies()
  
  return (
    <div className="Index">
      <h2>Movie</h2>
      <MovieView data={data?.results}/>
    </div>
  );
};

export default memo(Movie);