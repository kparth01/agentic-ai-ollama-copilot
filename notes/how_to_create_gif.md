
Convert `mov` to `mp4`:

`ffmpeg -i input.mov -c:v libx264 -preset fast -crf 23 output.mp4`

Convert `mp4` to `gif`:

`ffmpeg -i input.mp4 -filter:v "fps=48,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=single[p];[s1][p]paletteuse=dither=bayer" output.gif`

Increase speed of the `gif`:

`ffmpeg -i output.gif -filter_complex "[0:v]setpts=0.5*PTS,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" output_3.gif`

> For 1.5× speed, use setpts=`0.66*PTS`; for 3× speed, use setpts=`0.33*PTS`.