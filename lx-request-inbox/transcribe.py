"""Local cached model only. No paid APIs and no model downloads."""
import argparse, json, os
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('audio',type=Path);p.add_argument('output',type=Path);p.add_argument('--model',type=Path);args=p.parse_args()
    if not args.audio.is_file():p.error('audio file missing')
    models=Path.home()/'.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo/snapshots'
    candidates=[q for q in models.glob('*') if (q/'weights.safetensors').is_file() and (q/'config.json').is_file()]
    model=args.model or next(iter(candidates),None)
    if model is None or not model.is_dir():p.error('cached local model missing; do not download automatically')
    if args.output.exists():p.error('output already exists; preserve earlier transcription')
    os.environ['HF_HUB_OFFLINE']='1'
    import mlx_whisper
    data=mlx_whisper.transcribe(str(args.audio),path_or_hf_repo=str(model),verbose=False,word_timestamps=True,temperature=0.0)
    if not data.get('segments') or not data.get('text','').strip():raise RuntimeError('no usable speech; review required')
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with args.output.open('x') as f:json.dump(data,f,ensure_ascii=False,indent=2)
    print(json.dumps({'output':str(args.output),'segments':len(data['segments']),'language':data.get('language')}))
if __name__=='__main__':main()
