"""
Exports CineMatch pre-trained artifacts from movie_recommender_artifacts.joblib
into optimized, static JSON files for high-performance web deployment.
Zero retraining is performed. All data, clusters, and genre vectors are preserved verbatim.
"""

import os
import json
import joblib
import numpy as np

def export_data():
    artifacts_path = "movie_recommender_artifacts.joblib"
    if not os.path.exists(artifacts_path):
        raise FileNotFoundError(f"Cannot find {artifacts_path}")

    print("Loading joblib artifacts...")
    data = joblib.load(artifacts_path)

    movies_df = data["movies"]
    genre_features = data["genre_features"]
    kmeans = data["kmeans_model"]
    mlb = data["mlb"]

    genres_list = list(mlb.classes_)
    print(f"Total movies: {len(movies_df)}, Total genres: {len(genres_list)}")

    # Ensure output directories exist
    os.makedirs("public/data", exist_ok=True)

    # 1. Export compact movie catalog
    catalog = []
    for idx, row in movies_df.iterrows():
        # Compute 19-bit integer bitmask for genre features
        bitmask = 0
        for bit_i, val in enumerate(genre_features[idx]):
            if val > 0:
                bitmask |= (1 << bit_i)
        
        catalog.append({
            "i": int(idx),
            "id": int(row["movieId"]),
            "t": str(row["title"]),
            "g": str(row["genres"]),
            "c": int(row["cluster"]),
            "b": bitmask
        })

    catalog_path = "public/data/catalog.json"
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, separators=(",", ":"))
    print(f"Exported {len(catalog)} movies to {catalog_path} ({os.path.getsize(catalog_path):,} bytes)")

    # 2. Cluster metadata and archetypes (Clean, without emojis, without em-dashes)
    cluster_archetypes = {
        0: {
            "name": "Romantic Dramas and Melodramas",
            "description": "Heartfelt relationship dramas, period romance, and emotional character arcs.",
            "primary": "Drama, Romance"
        },
        1: {
            "name": "Crime and Neo-Noir Thrillers",
            "description": "Gritty crime investigations, heist narratives, and urban noir suspense.",
            "primary": "Crime, Drama, Thriller"
        },
        2: {
            "name": "Pure Comedies and Satire",
            "description": "Situational humor, parody, physical comedy, and lighthearted character journeys.",
            "primary": "Comedy"
        },
        3: {
            "name": "Horror and Psychological Suspense",
            "description": "Supernatural horror, psychological tension, creature features, and dark mysteries.",
            "primary": "Horror, Thriller"
        },
        4: {
            "name": "Romantic Comedies",
            "description": "Witty relationship comedies, courtship stories, and lighthearted romantic pairings.",
            "primary": "Comedy, Romance"
        },
        5: {
            "name": "Dramatic Epics and Character Studies",
            "description": "Historical narratives, war biographies, and focused dramatic character studies.",
            "primary": "Drama"
        },
        6: {
            "name": "Sci-Fi, Fantasy and Action Adventures",
            "description": "Speculative science fiction, space epics, fantasy quests, and high-concept action.",
            "primary": "Action, Adventure, Sci-Fi"
        },
        7: {
            "name": "Action and Crime Thrillers",
            "description": "High-velocity action setpieces, police thrillers, and explosive chases.",
            "primary": "Action, Crime, Thriller"
        },
        8: {
            "name": "Documentaries and Specialty Non-Fiction",
            "description": "Real-world historical accounts, investigative documentaries, and unclassified specialty releases.",
            "primary": "Documentary"
        },
        9: {
            "name": "Animation and Family Adventure",
            "description": "Feature animation, youth adventures, and cross-generational storytelling.",
            "primary": "Animation, Children, Fantasy"
        }
    }

    # Calculate cluster statistics and top genre combinations
    cluster_stats = {}
    for c in range(10):
        c_subset = movies_df[movies_df["cluster"] == c]
        top_combos = c_subset["genres"].value_counts().head(5).to_dict()
        samples = c_subset[["title", "genres"]].head(6).to_dict(orient="records")
        cluster_stats[str(c)] = {
            "count": int(len(c_subset)),
            "topGenres": top_combos,
            "samples": samples
        }

    # Find duplicate titles for disambiguation
    duplicated_mask = movies_df["title"].duplicated(keep=False)
    dup_df = movies_df[duplicated_mask]
    dup_titles = {}
    for title, group in dup_df.groupby("title"):
        dup_titles[title] = [
            {"index": int(i), "movieId": int(r["movieId"]), "genres": str(r["genres"]), "cluster": int(r["cluster"])}
            for i, r in group.iterrows()
        ]

    model_meta = {
        "totalMovies": len(movies_df),
        "totalDimensions": int(genre_features.shape[1]),
        "genres": genres_list,
        "nClusters": int(kmeans.n_clusters),
        "inertia": float(kmeans.inertia_),
        "metric": "Cosine",
        "archetypes": cluster_archetypes,
        "clusterStats": cluster_stats,
        "duplicates": dup_titles
    }

    meta_path = "public/data/model_meta.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(model_meta, f, indent=2)
    print(f"Exported model metadata to {meta_path} ({os.path.getsize(meta_path):,} bytes)")

if __name__ == "__main__":
    export_data()
