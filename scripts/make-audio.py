"""Create sampled mallets and short D-major celebration arrangements.
All excitation comes from the game's land/hit/jump recordings; no oscillators.
"""
from pathlib import Path
import subprocess, json
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/audio/effects'
SR = 44100

def decode(name):
    data = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(OUT / (name+'.mp3')), '-ar', str(SR), '-ac', '1', '-f', 'f32le', '-'])
    return np.frombuffer(data, dtype='<f4').astype(float)

land, hit, jump = (decode(n) for n in ['land', 'hit', 'jump'])

def grain(source, duration=.045):
    # Extract the actual attack of the recording, rather than its vocal tail.
    peak = int(np.argmax(np.convolve(source**2, np.ones(128)/128, mode='same')))
    start = max(0, peak-int(.008*SR))
    data = source[start:start+int(duration*SR)].copy()
    data -= data.mean()
    data *= np.hanning(len(data))
    return data / max(np.max(np.abs(data)), 1e-8)

attacks = [grain(land), grain(hit), grain(jump)]

def mallet(midi, duration=.8, kind=0):
    f = 440*2**((midi-69)/12)
    n = int(duration*SR)
    fft_size = 2**int(np.ceil(np.log2(n+SR)))
    spectrum = np.fft.rfft(attacks[kind], fft_size)
    hz = np.fft.rfftfreq(fft_size, 1/SR)
    response = np.zeros(len(hz), dtype=complex)
    # Resonant filtering turns recorded impacts into tuned, glassy percussion.
    for multiple, level, width in [(1,1,1.5), (2.01,.38,2.3), (3.99,.14,4), (5.43,.055,7)]:
        center = f*multiple
        response += level*width/(width+1j*(hz-center))
    y = np.fft.irfft(spectrum*response, fft_size)[:n]
    y /= max(np.max(np.abs(y)), 1e-8)
    y *= np.minimum(1, np.arange(n)/(.003*SR))
    tail = min(n, int(.06*SR)); y[-tail:] *= np.linspace(1,0,tail)
    return y

def arrange(length, notes, chords=(), percussion=False):
    mix = np.zeros((int(length*SR),2))
    def add(y, when, gain, pan=0):
        offset=int(when*SR); count=min(len(y), len(mix)-offset)
        if count<=0:return
        stereo=np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])
        mix[offset:offset+count] += y[:count,None]*stereo*gain
    for i,(t,midi,gain) in enumerate(notes):
        y=mallet(midi, .72, i%2)
        pan=(-.20,.18,.06)[i%3]
        add(y,t,gain,pan)
        add(y,t+.14,gain*.16,-pan)
        add(y,t+.31,gain*.065,pan)
    for t,root in chords:
        for j,interval in enumerate([0,4,7,12]):
            add(mallet(root+interval,1.25,2),t+j*.022,.17,[-.35,-.1,.1,.35][j])
    if percussion:
        tap = attacks[0] * np.exp(-np.arange(len(attacks[0]))/(.009*SR))
        for t in np.arange(.14,length-1,.28):add(tap,t,.045)
    # A short diffuse stereo room, baked offline, adds no runtime audio nodes.
    dry=mix.copy()
    for delay,gain in [(.043,.13),(.079,.10),(.113,.08),(.181,.05),(.263,.035)]:
        count=int(delay*SR)
        mix[count:] += dry[:-count,::-1]*gain
    fade=int(.16*SR);mix[-fade:] *= np.linspace(1,0,fade)[:,None]
    return mix

def export(name, mix, peak_db=-5):
    peak=np.max(np.abs(mix)); mix=mix/max(peak,1e-8)*10**(peak_db/20)
    subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','2','-i','-','-codec:a','libmp3lame','-b:a','128k',str(OUT/(name+'.mp3'))],input=mix.astype('<f4').tobytes(),check=True)
    print(json.dumps({'asset':name,'seconds':len(mix)/SR,'peakDb':20*np.log10(np.max(np.abs(mix))),'rmsDb':20*np.log10(np.sqrt(np.mean(mix**2))),'bytes':(OUT/(name+'.mp3')).stat().st_size}))

pickup=mallet(86,.23,1)
pickup *= np.exp(-np.arange(len(pickup))/(.065*SR))
export('collect-chime',np.column_stack([pickup,pickup]),-7)
export('milestone',arrange(2.0,[(0,74,.75),(.18,81,.68),(.38,86,.8)],[(.38,62)]))
export('victory',arrange(2.8,[(0,74,.65),(.16,78,.65),(.32,81,.72),(.56,86,.8),(.92,86,.55)],[(.0,62),(.56,62)]))
melody=[(i*.28,n,.55 if i%3 else .65) for i,n in enumerate([74,78,81,83,81,78,76,74,81,86])]
export('festival',arrange(4.5,melody,[(0,62),(1.12,67),(1.96,69),(2.52,62)],True))
grand=melody+[(3.08+i*.25,n,.68) for i,n in enumerate([78,81,86,88,90,93,86])]
export('grand-festival',arrange(6.8,grand,[(0,62),(1.12,67),(1.96,69),(2.52,62),(3.08,67),(3.83,69),(4.58,62)],True))
